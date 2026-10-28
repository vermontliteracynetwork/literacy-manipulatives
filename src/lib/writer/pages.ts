import * as Y from 'yjs';

// The Writer's pages (her answer 2026-10-28): a draft is a set of pages, like tabs. On a shared board the
// teacher makes the pages and sets, for each student, whether a page is editable (pencil), view only (eye) or
// hidden (X): an example page everyone can read, a page per student only that student can see, a page several
// students write on together. The teacher and up to five or more students can type in the same page at once.
//
// Each page's text is a Yjs document (a CRDT), so people typing in the same page at the same time never undo
// each other. The teacher's copy is the true one: students send their changes to the teacher, who checks the
// student may edit that page, applies them and sends them on to everyone. Hidden pages are left out of a
// student's page list; their text still travels on the shared channel, so this is a classroom view setting,
// not a privacy guarantee.

export type PageAccess = 'edit' | 'view' | 'none';
export interface PageMeta { id: string; title: string; everyone: PageAccess; access: Record<string, PageAccess> }
export interface RemoteCaret { from: string; name: string; color: string; page: string; rel: unknown; at: number }
export type WriterMsg =
  | { t: 'hello' }
  | { t: 'sync'; page: string; state: string }
  | { t: 'upd'; page: string; update: string; from: string }
  | { t: 'rel'; page: string; update: string }
  | { t: 'caret'; from: string; name: string; color: string; page: string; rel: unknown }
  | { t: 'formula'; from: string; name: string; code: string; sentence: string; slots?: string[] };

export const LOCAL = 'local';
const REMOTE = 'remote';
const CARET_STALE_MS = 12000;

const b64 = (u: Uint8Array) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const newId = () => `p-${Math.random().toString(36).slice(2, 9)}`;
export const accessFor = (p: PageMeta, who: string): PageAccess => p.access[who] ?? p.everyone;

export class PageStore {
  pages: PageMeta[] = [];
  carets: Record<string, RemoteCaret> = {};
  version = 0;
  // Who this device is on a shared board, and how its messages go out (set by the board while sharing).
  me = { id: 'me', name: '', color: '#1968AB' };
  send: ((m: WriterMsg) => void) | null = null;
  // Called when a student's new sentence pattern arrives (teacher only).
  onFormula: ((m: Extract<WriterMsg, { t: 'formula' }>) => void) | null = null;
  private docs = new Map<string, Y.Doc>();
  private listeners = new Set<() => void>();
  private saveTimer: number | null = null;
  private readonly role: 'host' | 'student';
  private readonly storageKey?: string;

  constructor(role: 'host' | 'student', storageKey?: string) {
    this.role = role;
    this.storageKey = storageKey;
    if (storageKey) this.load();
    if (role === 'host' && !this.pages.length) this.addPage('Page 1');
  }

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private emit() { this.version++; this.listeners.forEach((f) => f()); }

  doc(id: string): Y.Doc {
    let d = this.docs.get(id);
    if (d) return d;
    d = new Y.Doc();
    this.docs.set(id, d);
    d.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin !== REMOTE) {
        if (this.role === 'host') this.send?.({ t: 'rel', page: id, update: b64(update) });
        else this.send?.({ t: 'upd', page: id, update: b64(update), from: this.me.id });
      }
      this.queueSave();
      this.emit();
    });
    return d;
  }
  text(id: string) { return this.doc(id).getText('t'); }

  // Replace a page's text with `next`, as the smallest change (so other people's typing elsewhere is kept).
  setText(id: string, next: string) {
    const t = this.text(id);
    const cur = t.toString();
    if (cur === next) return;
    let a = 0;
    while (a < cur.length && a < next.length && cur[a] === next[a]) a++;
    let b = 0;
    while (b < cur.length - a && b < next.length - a && cur[cur.length - 1 - b] === next[next.length - 1 - b]) b++;
    this.doc(id).transact(() => {
      if (cur.length - a - b > 0) t.delete(a, cur.length - a - b);
      if (next.length - a - b > 0) t.insert(a, next.slice(a, next.length - b));
    }, LOCAL);
  }

  // ---------- Pages (teacher, or anyone on their own device) ----------
  addPage(title: string, everyone: PageAccess = 'edit', access: Record<string, PageAccess> = {}): string {
    const id = newId();
    this.pages = [...this.pages, { id, title, everyone, access }];
    this.doc(id);
    this.queueSave();
    this.emit();
    return id;
  }
  updatePage(id: string, patch: Partial<PageMeta>) {
    this.pages = this.pages.map((p) => (p.id === id ? { ...p, ...patch } : p));
    this.queueSave();
    this.emit();
  }
  setAccess(id: string, who: string, a: PageAccess) {
    const p = this.pages.find((x) => x.id === id);
    if (!p) return;
    if (who === 'everyone') this.updatePage(id, { everyone: a, access: {} });
    else this.updatePage(id, { access: { ...p.access, [who]: a } });
  }
  removePage(id: string) {
    if (this.pages.length <= 1) return;
    this.pages = this.pages.filter((p) => p.id !== id);
    this.docs.get(id)?.destroy();
    this.docs.delete(id);
    this.queueSave();
    this.emit();
  }
  // One page per student that only that student (and the teacher) can see and write in.
  pagePerStudent(students: { id: string; name: string }[]) {
    for (const st of students) {
      if (this.pages.some((p) => p.access[st.id] === 'edit' && p.everyone === 'none')) continue;
      this.addPage(st.name, 'none', { [st.id]: 'edit' });
    }
  }

  // ---------- Sharing ----------
  // Student: the teacher's page list, keeping only the pages this student may see.
  setSharedPages(all: PageMeta[]) {
    const mine = all.filter((p) => accessFor(p, this.me.id) !== 'none');
    if (JSON.stringify(mine) === JSON.stringify(this.pages)) return;
    this.pages = mine;
    mine.forEach((p) => this.doc(p.id));
    this.emit();
  }
  syncAll() { for (const p of this.pages) this.send?.({ t: 'sync', page: p.id, state: b64(Y.encodeStateAsUpdate(this.doc(p.id))) }); }

  receive(m: WriterMsg) {
    if (m.t === 'hello') { if (this.role === 'host') this.syncAll(); return; }
    if (m.t === 'caret') {
      if (m.from === this.me.id) return;
      this.carets = { ...this.carets, [m.from]: { ...m, at: Date.now() } };
      this.emit();
      return;
    }
    if (m.t === 'formula') { if (this.role === 'host') this.onFormula?.(m); return; }
    if (m.t === 'upd') {
      if (this.role !== 'host') return;
      const p = this.pages.find((x) => x.id === m.page);
      if (!p || accessFor(p, m.from) !== 'edit') return;
      Y.applyUpdate(this.doc(m.page), unb64(m.update), REMOTE);
      this.send?.({ t: 'rel', page: m.page, update: m.update });
      return;
    }
    if (this.role === 'student') Y.applyUpdate(this.doc(m.page), unb64(m.t === 'sync' ? m.state : m.update), REMOTE);
  }

  // Where I'm typing, for everyone else's screen.
  sendCaret(page: string, index: number) {
    if (!this.send) return;
    const rel = Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(this.text(page), index));
    this.send({ t: 'caret', from: this.me.id, name: this.me.name, color: this.me.color, page, rel });
  }
  caretsOn(page: string): { from: string; name: string; color: string; index: number }[] {
    const now = Date.now();
    return Object.values(this.carets).flatMap((c) => {
      if (c.page !== page || now - c.at > CARET_STALE_MS) return [];
      const abs = Y.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(c.rel), this.doc(page));
      return abs ? [{ from: c.from, name: c.name, color: c.color, index: abs.index }] : [];
    });
  }
  peopleOn(page: string) { const now = Date.now(); return Object.values(this.carets).filter((c) => c.page === page && now - c.at <= CARET_STALE_MS); }

  // ---------- Saving on this device ----------
  private queueSave() {
    if (!this.storageKey) return;
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.save(), 400);
  }
  private save() {
    if (!this.storageKey) return;
    const states = Object.fromEntries(this.pages.map((p) => [p.id, b64(Y.encodeStateAsUpdate(this.doc(p.id)))]));
    try { localStorage.setItem(this.storageKey, JSON.stringify({ pages: this.pages, states })); } catch { /* not saved */ }
  }
  private load() {
    try {
      const raw = localStorage.getItem(this.storageKey!);
      if (raw) {
        const { pages, states } = JSON.parse(raw) as { pages: PageMeta[]; states: Record<string, string> };
        this.pages = pages;
        for (const p of pages) if (states[p.id]) Y.applyUpdate(this.doc(p.id), unb64(states[p.id]), REMOTE);
        return;
      }
      // A draft from before pages (2026-10-27) becomes Page 1.
      const old = sessionStorage.getItem('lm-writer-doc');
      if (old) { const id = this.addPage('Page 1'); this.text(id).insert(0, old); }
    } catch { /* start fresh */ }
  }
}
