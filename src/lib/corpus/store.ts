// The Symbolic Grammar log (her request 2026-11-20): every passage run through Mark up a passage, every line in it,
// its line type, its formula code and its words. Kept privately in this browser (IndexedDB), never sent anywhere; the
// private Symbolic Grammar tab reads it for formula frequency, formulas not in her list, structures and words.
// Download everything as a file to keep a copy or move it to another computer.

import type { LineType, PassageItem } from 'symbolic-grammar-engine/src/writer/passage';
import type { SymbolWordClass } from '../grammarSymbols';

export type TextKind = 'story' | 'informational' | 'everyday' | 'poem' | 'learner';
export const TEXT_KINDS: { id: TextKind; name: string }[] = [
  { id: 'story', name: 'Story or folktale' },
  { id: 'informational', name: 'Informational' },
  { id: 'everyday', name: 'Everyday writing (forms, signs, messages, directions)' },
  { id: 'poem', name: 'Poem or song' },
  { id: 'learner', name: 'Learner writing' },
];
export const LICENSES = ['Public domain', 'CC BY', 'CC BY-SA', 'CC BY-NC', 'Learner writing (private)', 'Other (check before sharing)'];

export interface CorpusSource {
  id: string; title: string; origin: 'student' | 'public'; textKind: TextKind; license: string;
  gradeBand: string; year: string; addedAt: string; lines: number; sentences: number;
}
export interface CorpusItem {
  id?: number; sourceId: string; n: number; line: number; type: LineType; text: string;
  job?: PassageItem['job']; code: string; listed: string; inList: boolean; closest: string[]; family: string[];
  dialogue: boolean; informal: boolean; missing?: 'who' | 'action' | null; words: [string, SymbolWordClass][];
}

const DB = 'sg-corpus';
let opening: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      d.createObjectStore('sources', { keyPath: 'id' });
      d.createObjectStore('items', { keyPath: 'id', autoIncrement: true }).createIndex('sourceId', 'sourceId');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { opening = null; reject(req.error); };
  });
  return opening;
}
const done = (t: IDBTransaction) => new Promise<void>((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
const all = <T>(store: IDBObjectStore) => new Promise<T[]>((res, rej) => { const r = store.getAll(); r.onsuccess = () => res(r.result as T[]); r.onerror = () => rej(r.error); });

export async function saveSource(source: CorpusSource, items: Omit<CorpusItem, 'id' | 'sourceId'>[]): Promise<void> {
  const d = await db();
  const t = d.transaction(['sources', 'items'], 'readwrite');
  t.objectStore('sources').put(source);
  const store = t.objectStore('items');
  for (const it of items) store.add({ ...it, sourceId: source.id });
  await done(t);
}
export async function readCorpus(): Promise<{ sources: CorpusSource[]; items: CorpusItem[] }> {
  const d = await db();
  const t = d.transaction(['sources', 'items'], 'readonly');
  const [sources, items] = await Promise.all([all<CorpusSource>(t.objectStore('sources')), all<CorpusItem>(t.objectStore('items'))]);
  return { sources: sources.sort((a, b) => a.addedAt.localeCompare(b.addedAt)), items };
}
export async function removeSource(id: string): Promise<void> {
  const d = await db();
  const t = d.transaction(['sources', 'items'], 'readwrite');
  t.objectStore('sources').delete(id);
  const idx = t.objectStore('items').index('sourceId');
  const req = idx.openCursor(IDBKeyRange.only(id));
  req.onsuccess = () => { const c = req.result; if (c) { c.delete(); c.continue(); } };
  await done(t);
}
// Same title and same first line: the passage is already in the log.
export async function hasSource(title: string, firstLine: string): Promise<boolean> {
  const { sources, items } = await readCorpus();
  return sources.some((s) => s.title === title && items.some((i) => i.sourceId === s.id && i.n === 1 && i.text === firstLine));
}

// Formula reviews (her rule 2026-11-20: Beth narrows, she approves). Small, so kept in localStorage.
export type ReviewStatus = 'candidate' | 'reviewed' | 'approved' | 'not now';
export interface FormulaReview { status: ReviewStatus; fixed?: boolean; symbols?: boolean; order?: boolean; standard?: boolean; notes: string; at: string }
const REVIEWS = 'sg-formula-reviews-v1';
export function readReviews(): Record<string, FormulaReview> { try { return JSON.parse(localStorage.getItem(REVIEWS) ?? '{}'); } catch { return {}; } }
export function writeReview(code: string, r: FormulaReview): Record<string, FormulaReview> {
  const all2 = { ...readReviews(), [code]: { ...r, at: new Date().toISOString().slice(0, 10) } };
  try { localStorage.setItem(REVIEWS, JSON.stringify(all2)); } catch { /* not saved */ }
  return all2;
}

export async function exportCorpus(): Promise<string> {
  const { sources, items } = await readCorpus();
  return JSON.stringify({ kind: 'sg-corpus', at: new Date().toISOString().slice(0, 10), sources, items: items.map(({ id: _id, ...rest }) => rest), reviews: readReviews() });
}
export async function importCorpus(json: string): Promise<number> {
  const d0 = JSON.parse(json) as { kind?: string; sources?: CorpusSource[]; items?: CorpusItem[]; reviews?: Record<string, FormulaReview> };
  if (d0.kind !== 'sg-corpus') throw new Error('not a log file');
  const have = new Set((await readCorpus()).sources.map((s) => s.id));
  let added = 0;
  for (const s of d0.sources ?? []) {
    if (have.has(s.id)) continue;
    await saveSource(s, (d0.items ?? []).filter((i) => i.sourceId === s.id));
    added++;
  }
  if (d0.reviews) try { localStorage.setItem(REVIEWS, JSON.stringify({ ...d0.reviews, ...readReviews() })); } catch { /* not saved */ }
  return added;
}

export const PRIVATE_FLAG = 'lm-sg-private';
