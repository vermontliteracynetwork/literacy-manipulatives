import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HomeButton } from '../HomeButton';
import { ReferencePopover } from '../ReferencePopover';
import { GRAMMAR_SYMBOL_INFO, TENSE_SYMBOLS, type SymbolWordClass } from '../../lib/grammarSymbols';
import { buildUtterance } from '../../lib/tts';
import {
  analyze, baseChoices, choicesFor, EMPTY_CONTEXT, exampleFill, formulaWords, KIND_CLASS, KIND_LABEL, needsPick, nextContext, placeChoices, prepChoices,
  rollAll, rollToken, storyFormulas, uid,
  type Analysis, type Kind, type SentenceState, type StoryContext, type StoryFormula, type Token,
} from '../../lib/story/grammar';
import { drawExportFrame, drawScene, EXPORT_H, EXPORT_W, HI, makeClip, SH, SW, WIDE, wordAt, type Assets, type Clip } from '../../lib/story/render';
import type { Tense } from '../../lib/story/words';
import './storyMaker.css';

// Story Maker (her request 2026-11-17): build sentences from her formulas and grammar symbols, Mad Lib style, and
// watch a pixel video act out exactly what the words mean. Layout (her request the same day): a whiteboard-style
// materials menu on the left, a 16:9 video on top, and a word processor below with one row per sentence. Read aloud
// only when a button is clicked. The saved video is vertical (9:16): the video on top, the sentence with her
// symbols below. Nothing is stored online.

interface Row { id: string; s: SentenceState }
type DragItem =
  | { type: 'kind'; kind: Kind }
  | { type: 'formula'; f: StoryFormula }
  | { type: 'slot'; row: number; index: number }
  | { type: 'tense'; tense: Tense }
  | { type: 'line'; row: number };
type Target = { row: number | 'new'; at: number } | { lines: number } | null;
interface DragState { item: DragItem; label: string; img?: string; x: number; y: number; target: Target }

const TENSES: Tense[] = ['past', 'present', 'future'];
const newRow = (): Row => ({ id: uid(), s: { tokens: [], tense: 'past', contract: false } });

const SYMBOLS: { kind: Kind; cls: SymbolWordClass; name: string; note: string }[] = [
  { kind: 'article', cls: 'article', name: 'Article', note: 'a, an, the' },
  { kind: 'adjective', cls: 'adjective', name: 'Adjective', note: 'Describes a noun' },
  { kind: 'noun', cls: 'noun', name: 'Noun', note: 'Person, place, thing, animal' },
  { kind: 'propernoun', cls: 'propernoun', name: 'Proper noun', note: 'A name' },
  { kind: 'pronoun', cls: 'pronoun', name: 'Pronoun', note: 'I, you, he, she, it, we, they' },
  { kind: 'verb', cls: 'verb', name: 'Verb', note: 'Action word' },
  { kind: 'adverb', cls: 'adverb', name: 'Adverb', note: 'How, when or where' },
  { kind: 'phrase', cls: 'preposition', name: 'Prepositional phrase', note: 'to the park, under the bridge' },
  { kind: 'conj', cls: 'conjunction', name: 'Conjunction', note: 'and, but, so, because' },
  { kind: 'interjection', cls: 'interjection', name: 'Interjection', note: 'Wow! Oops!' },
];
const HELPERS: { kind: Kind; cls: SymbolWordClass; name: string; note: string }[] = [
  { kind: 'will', cls: 'verb', name: 'will', note: 'Makes it future' },
  { kind: 'be', cls: 'verb', name: 'be', note: 'am, is, are, was, were' },
  { kind: 'do', cls: 'verb', name: 'do', note: 'do, does, did' },
  { kind: 'not', cls: 'adverb', name: 'not', note: 'The opposite' },
];

const symbolUrl = (cls: SymbolWordClass) => GRAMMAR_SYMBOL_INFO[cls].imageUrl;
const VIDEO_W = (SW + 2 * WIDE) * HI;
const VIDEO_H = SH * HI;

function speak(text: string) {
  try {
    if (!('speechSynthesis' in window) || !text) return;
    window.speechSynthesis.cancel();
    const u = buildUtterance(text);
    u.rate = 0.92;
    window.speechSynthesis.speak(u);
  } catch { /* no voice on this device */ }
}

function pickMime(): { mime: string; ext: string } | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const tries: [string, string][] = [['video/mp4;codecs=avc1.42E01E', 'mp4'], ['video/mp4', 'mp4'], ['video/webm;codecs=vp9', 'webm'], ['video/webm;codecs=vp8', 'webm'], ['video/webm', 'webm']];
  for (const [mime, ext] of tries) if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  return null;
}

/** Fade between clips, so a story plays like one video. */
function fade(h: CanvasRenderingContext2D, t: number, d: number, w: number, hh: number) {
  const a = t < 0.2 ? 1 - t / 0.2 : t > d - 0.25 ? (t - (d - 0.25)) / 0.25 : 0;
  if (a <= 0) return;
  h.save(); h.globalAlpha = Math.min(1, a); h.fillStyle = '#0F2B45'; h.fillRect(0, 0, w, hh); h.restore();
}

function useAssets(): Assets {
  return useMemo(() => {
    const img = (src: string) => { const i = new Image(); i.src = src; return i; };
    const tense = { past: img(TENSE_SYMBOLS.past.imageUrl), present: img(TENSE_SYMBOLS.present.imageUrl), future: img(TENSE_SYMBOLS.future.imageUrl) };
    const symbols: Record<string, HTMLImageElement> = {};
    for (const k of Object.keys(GRAMMAR_SYMBOL_INFO) as SymbolWordClass[]) symbols[k] = img(symbolUrl(k));
    return { tense, symbols };
  }, []);
}

// One collapsible category, the same as the whiteboard's materials menu.
function Category({ label, color, open, onToggle, children }: { label: string; color: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="lm-category">
      <button type="button" className="lm-category-header sm-cat-head" style={{ background: color }} onClick={onToggle} aria-expanded={open}>
        <span>{label}</span>
        <span aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="lm-category-body">{children}</div>}
    </div>
  );
}

type Ch = { preps: string[]; places: string[] } | { list: { value: string; label: string }[] } | null;

export function StoryMaker() {
  const assets = useAssets();
  const formulas = useMemo(() => storyFormulas(), []);
  const [rows, setRows] = useState<Row[]>(() => [newRow()]);
  const [active, setActive] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [open, setOpen] = useState({ formulas: true, symbols: true, helpers: false, tense: true });
  const [query, setQuery] = useState('');
  const [playing, setPlaying] = useState(false);
  const [rec, setRec] = useState<{ progress: number } | null>(null);
  const [recError, setRecError] = useState('');
  const [drag, setDrag] = useState<DragState | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [caption, setCaption] = useState<{ key: string; active: number }>({ key: '', active: -1 });

  const act = Math.min(active, rows.length - 1);

  /* ---- Every sentence, read in order so he, she, it and they follow the story ---- */
  const data = useMemo(() => {
    const out: { row: Row; a: Analysis; clip: Clip | null; before: StoryContext; after: StoryContext }[] = [];
    for (const row of rows) {
      const before = out.length ? out[out.length - 1].after : EMPTY_CONTEXT;
      const a = analyze(row.s, before);
      out.push({ row, a, clip: a.status === 'ok' ? makeClip(a, before) : null, before, after: nextContext(before, a) });
    }
    return out;
  }, [rows]);
  const playlist = useMemo(() => data.flatMap((d) => (d.clip ? [{ clip: d.clip, code: d.a.code }] : [])), [data]);
  const activeData = data[act];

  /* ---- The video ---- */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ clip: null as Clip | null, playlist, playing: false, start: 0, capKey: '', capActive: -1 });
  const previewClip = activeData?.clip ?? null;
  useEffect(() => {
    Object.assign(live.current, { clip: previewClip, playlist, playing });
  }, [previewClip, playlist, playing]);

  useEffect(() => {
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const h = canvasRef.current?.getContext('2d');
      if (!h) return;
      const L = live.current;
      let shown: Clip | null = null;
      let t = 0;
      if (L.playing) {
        let e = (now - L.start) / 1000;
        let idx = 0;
        while (idx < L.playlist.length && e >= L.playlist[idx].clip.duration) { e -= L.playlist[idx].clip.duration; idx++; }
        if (idx >= L.playlist.length) { setPlaying(false); return; }
        shown = L.playlist[idx].clip; t = e;
        drawScene(h, shown, t, assets, 'meadow', true);
        fade(h, t, shown.duration, VIDEO_W, VIDEO_H);
      } else if (L.clip) {
        shown = L.clip; t = (now / 1000) % L.clip.duration;
        drawScene(h, shown, t, assets, 'meadow', true);
      } else {
        h.clearRect(0, 0, VIDEO_W, VIDEO_H);
      }
      const key = shown ? shown.text : '';
      const activeWord = shown ? wordAt(t, shown.words.length) : -1;
      if (key !== L.capKey || activeWord !== L.capActive) { L.capKey = key; L.capActive = activeWord; setCaption({ key, active: activeWord }); }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [assets]);

  const shownClip = playing ? playlist.find((p) => p.clip.text === caption.key)?.clip ?? null : previewClip;

  const play = () => {
    if (playing) { setPlaying(false); return; }
    if (!playlist.length) return;
    live.current.start = performance.now();
    setPlaying(true);
  };

  /* ---- Saving the video (vertical, 9:16) ---- */
  const cancelRec = useRef(false);
  const saveVideo = async () => {
    setRecError('');
    const fmt = pickMime();
    if (!fmt || !playlist.length) { setRecError('This browser cannot save video. Try Chrome, Edge or Safari.'); return; }
    setPlaying(false);
    const cv = document.createElement('canvas');
    cv.width = EXPORT_W; cv.height = EXPORT_H;
    cv.className = 'sm-offscreen';
    document.body.appendChild(cv);
    const h = cv.getContext('2d')!;
    const list = playlist;
    drawExportFrame(h, list[0].clip, 0, assets, 0, list.length, list[0].code);
    const stream = (cv as HTMLCanvasElement & { captureStream(fps?: number): MediaStream }).captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: fmt.mime, videoBitsPerSecond: 5_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
    cancelRec.current = false;
    setRec({ progress: 0 });
    recorder.start(250);
    const total = list.reduce((s, x) => s + x.clip.duration, 0);
    const start = performance.now();
    await new Promise<void>((resolve) => {
      const step = (now: number) => {
        let e = (now - start) / 1000;
        if (e >= total || cancelRec.current) { resolve(); return; }
        setRec({ progress: e / total });
        let idx = 0;
        while (idx < list.length - 1 && e >= list[idx].clip.duration) { e -= list[idx].clip.duration; idx++; }
        const { clip: c, code } = list[idx];
        drawExportFrame(h, c, e, assets, idx, list.length, code);
        fade(h, e, c.duration, EXPORT_W, EXPORT_H);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    recorder.stop();
    await done;
    stream.getTracks().forEach((tr) => tr.stop());
    cv.remove();
    setRec(null);
    if (cancelRec.current) return;
    const blob = new Blob(chunks, { type: fmt.mime.split(';')[0] });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-story.${fmt.ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  /* ---- Editing the rows ---- */
  const updateRow = (r: number, fn: (s: SentenceState) => SentenceState) => setRows((rs) => rs.map((row, i) => (i === r ? { ...row, s: fn(row.s) } : row)));
  const setToken = (r: number, i: number, patch: Partial<Token>) => updateRow(r, (s) => ({ ...s, tokens: s.tokens.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const insertToken = (s: SentenceState, kind: Kind, at: number): SentenceState => {
    const tokens = [...s.tokens];
    tokens.splice(at, 0, { id: uid(), kind, value: kind === 'conj' ? 'and' : undefined });
    return { ...s, tokens, exclaim: false };
  };
  const addRowWith = (fn: (s: SentenceState) => SentenceState, after = rows.length - 1) => {
    const row = newRow();
    row.s = fn(row.s);
    setRows((rs) => [...rs.slice(0, after + 1), row, ...rs.slice(after + 1)]);
    setActive(after + 1);
  };
  const tapFormula = (f: StoryFormula) => {
    const last = rows.length - 1;
    if (!rows[last]?.s.tokens.length) { const ctx = data[last]?.before ?? EMPTY_CONTEXT; updateRow(last, () => exampleFill(f, ctx)); setActive(last); }
    else { const ctx = data[last]?.after ?? EMPTY_CONTEXT; addRowWith(() => exampleFill(f, ctx)); }
  };
  const tapKind = (kind: Kind) => updateRow(act, (s) => insertToken(s, kind, s.tokens.length));
  const moveSlot = (from: { row: number; index: number }, to: { row: number; at: number }) => setRows((rs) => {
    const next = rs.map((r) => ({ ...r, s: { ...r.s, tokens: [...r.s.tokens] } }));
    const [tok] = next[from.row].s.tokens.splice(from.index, 1);
    let at = to.at;
    if (from.row === to.row && at > from.index) at -= 1;
    next[to.row].s.tokens.splice(at, 0, tok);
    return next;
  });
  const removeRow = (r: number) => {
    setRows((rs) => (rs.length === 1 ? [newRow()] : rs.filter((_, i) => i !== r)));
    setActive((a) => Math.max(0, a > r ? a - 1 : Math.min(a, rows.length - 2)));
  };
  const swapRows = (a: number, b: number) => {
    if (b < 0 || b >= rows.length) return;
    setRows((rs) => { const n = [...rs]; [n[a], n[b]] = [n[b], n[a]]; return n; });
    setActive(b);
  };

  /* ---- Drag and drop ---- */
  const rowEls = useRef<(HTMLLIElement | null)[]>([]);
  const slotEls = useRef(new Map<string, HTMLElement>());
  const newZone = useRef<HTMLDivElement>(null);
  const justDragged = useRef(false);

  const hitTest = useCallback((x: number, y: number, item: DragItem): Target => {
    const inside = (el: Element | null | undefined) => { if (!el) return false; const r = el.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; };
    if (item.type === 'line') {
      let at = rows.length;
      for (let i = 0; i < rows.length; i++) {
        const el = rowEls.current[i];
        if (!el) continue;
        const b = el.getBoundingClientRect();
        if (y < b.top + b.height / 2) { at = i; break; }
      }
      return { lines: at };
    }
    const r = rowEls.current.findIndex((el, i) => i < rows.length && inside(el));
    if (r < 0) return inside(newZone.current) && item.type !== 'tense' ? { row: 'new', at: 0 } : null;
    const n = rows[r].s.tokens.length;
    let best = { d: Infinity, at: n };
    for (let i = 0; i < n; i++) {
      const el = slotEls.current.get(`${r}:${i}`);
      if (!el) continue;
      const b = el.getBoundingClientRect();
      const cx = b.left + b.width / 2;
      const d = Math.abs(y - (b.top + b.height / 2)) * 3 + Math.abs(x - cx);
      if (d < best.d) best = { d, at: x < cx ? i : i + 1 };
    }
    return { row: r, at: best.at };
  }, [rows]);

  const ctxAt = (r: number) => data[r]?.before ?? data[data.length - 1]?.after ?? EMPTY_CONTEXT;
  const drop = (item: DragItem, target: Target) => {
    if (!target) return;
    if ('lines' in target) {
      if (item.type !== 'line') return;
      const to = target.lines > item.row ? target.lines - 1 : target.lines;
      if (to === item.row) return;
      setRows((rs) => { const n = [...rs]; const [x] = n.splice(item.row, 1); n.splice(to, 0, x); return n; });
      setActive(to);
      return;
    }
    if (target.row === 'new') {
      const lastEmpty = rows.length && !rows[rows.length - 1].s.tokens.length ? rows.length - 1 : -1;
      const put = (fn: (s: SentenceState) => SentenceState) => {
        if (lastEmpty >= 0) { updateRow(lastEmpty, fn); setActive(lastEmpty); } else addRowWith(fn);
      };
      if (item.type === 'formula') put(() => exampleFill(item.f, ctxAt(lastEmpty >= 0 ? lastEmpty : rows.length)));
      else if (item.type === 'kind') put((s) => insertToken(s, item.kind, 0));
      else if (item.type === 'slot') {
        const tok = rows[item.row].s.tokens[item.index];
        setRows((rs) => [...rs.map((r, i) => (i === item.row ? { ...r, s: { ...r.s, tokens: r.s.tokens.filter((_, j) => j !== item.index) } } : r)), { ...newRow(), s: { tokens: [tok], tense: 'past', contract: false } }]);
        setActive(rows.length);
      }
      return;
    }
    const r = target.row;
    setActive(r);
    if (item.type === 'formula') updateRow(r, () => exampleFill(item.f, ctxAt(r)));
    else if (item.type === 'kind') updateRow(r, (s) => insertToken(s, item.kind, target.at));
    else if (item.type === 'tense') updateRow(r, (s) => ({ ...s, tense: item.tense }));
    else if (item.type === 'slot' && !(item.row === r && (target.at === item.index || target.at === item.index + 1))) moveSlot(item, { row: r, at: target.at });
  };

  const startDrag = (item: DragItem, label: string, img?: string) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (e.pointerType === 'mouse') e.preventDefault(); // no text selection while dragging
    const sx = e.clientX;
    const sy = e.clientY;
    let started = false;
    const move = (ev: PointerEvent) => {
      if (!started) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 7) return;
        started = true;
      }
      setDrag({ item, label, img, x: ev.clientX, y: ev.clientY, target: hitTest(ev.clientX, ev.clientY, item) });
    };
    const up = (ev: PointerEvent) => {
      cleanup();
      if (!started) return;
      drop(item, hitTest(ev.clientX, ev.clientY, item));
      setDrag(null);
      justDragged.current = true;
      setTimeout(() => { justDragged.current = false; }, 60);
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
  const tap = (fn: () => void) => () => { if (!justDragged.current) fn(); };
  const keyTap = (fn: () => void) => (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };

  /* ---- The bar between the video and the page: drag to resize ---- */
  const [videoH, setVideoH] = useState(() => { try { return Number(localStorage.getItem('sm-video-h')) || 300; } catch { return 300; } });
  useEffect(() => { try { localStorage.setItem('sm-video-h', String(Math.round(videoH))); } catch { /* not remembered */ } }, [videoH]);
  const mainRef = useRef<HTMLElement>(null);
  const clampH = (h: number) => Math.max(150, Math.min(h, (mainRef.current?.clientHeight ?? 800) - 140));
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const y0 = e.clientY;
    const h0 = videoH;
    const move = (ev: PointerEvent) => setVideoH(clampH(h0 + ev.clientY - y0));
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  /* ---- Dropdown choices for every blank, in every row ---- */
  const choices = useMemo(() => data.map((d) => d.row.s.tokens.map((tok, i): Ch => {
    const s = d.row.s;
    if (tok.kind === 'phrase') return { preps: prepChoices(s, i, d.before), places: placeChoices(s, i, d.before) };
    if (tok.kind === 'conj') return { list: baseChoices('conj') };
    if (!needsPick(tok.kind)) return null;
    const list = choicesFor(s, i, d.before);
    if (tok.value && !list.some((c) => c.value === tok.value)) list.unshift(baseChoices(tok.kind).find((c) => c.value === tok.value) ?? { value: tok.value, label: tok.value });
    return { list };
  })), [data]);

  const q = query.trim().toLowerCase();
  const shownFormulas = formulas.filter((f) => !q || f.code.toLowerCase().includes(q) || f.formula.includes(q));
  const symbolMatch = (name: string, note: string) => !q || name.toLowerCase().includes(q) || note.toLowerCase().includes(q);

  const tile = (p: { kind: Kind; cls: SymbolWordClass; name: string; note: string }, word?: boolean) => (
    <div key={p.kind} className="sm-tile-wrap">
      <ReferencePopover mode="hover" title={p.name} body={p.note}>
        <div
          role="button"
          tabIndex={0}
          aria-label={`${p.name}: ${p.note}. Drag into a sentence, or press Enter to add it.`}
          className="sm-tile"
          onPointerDown={startDrag({ type: 'kind', kind: p.kind }, p.name, symbolUrl(p.cls))}
          onClick={tap(() => tapKind(p.kind))}
          onKeyDown={keyTap(() => tapKind(p.kind))}
        >
          <img src={symbolUrl(p.cls)} alt="" draggable={false} />
        </div>
      </ReferencePopover>
      {word && <span>{p.name}</span>}
    </div>
  );

  return (
    <div className={`sm-page${drag ? ' sm-dragging' : ''}`}>
      <div className="lm-toolbar sm-toolbar">
        <HomeButton />
        <a className="lm-sidebar-title lm-home-link" href="/" title="Back to all tools">Story Maker</a>
        <button type="button" className="btn btn-sm" onClick={() => setSidebarOpen((v) => !v)} aria-label={sidebarOpen ? 'Hide materials' : 'Show materials'}>{sidebarOpen ? '⟨⟨' : '⟩⟩'}</button>
        <span className="lm-toolbar-divider" />
        <button type="button" className="btn btn-sm" aria-haspopup="dialog" onClick={() => setShowHelp(true)}>How it works</button>
        <span className="sm-grow" />
        <button type="button" className="btn btn-sm btn-primary" onClick={play} disabled={!playlist.length || !!rec}>
          {playing ? '■ Stop' : playlist.length > 1 ? '▶ Play story' : '▶ Play'}
        </button>
        <button type="button" className="btn btn-sm" onClick={() => void saveVideo()} disabled={!playlist.length || !!rec}>Save video</button>
      </div>

      <div className="sm-shell">
        {sidebarOpen && (
          <aside className="lm-sidebar sm-sidebar" aria-label="Materials">
            <input className="lm-tray-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a formula or symbol" aria-label="Find a formula or symbol" />

            <Category label="Sentence Formulas" color="#C0D6F5" open={open.formulas} onToggle={() => setOpen((o) => ({ ...o, formulas: !o.formulas }))}>
              <div className="sm-formula-list">
                {shownFormulas.map((f) => (
                  <div key={`${f.code}|${f.kinds.join(' ')}`} className="sm-fcard">
                    <button type="button" className="sm-plus" onClick={() => tapFormula(f)} aria-label={`Add ${f.code}: ${f.example}`} title="Add">+</button>
                    <div
                      role="button"
                      tabIndex={0}
                      className="sm-fbody"
                      aria-label={`Formula ${f.code}: ${formulaWords(f)}. Drag onto the page.`}
                      onPointerDown={startDrag({ type: 'formula', f }, f.code)}
                      onClick={tap(() => tapFormula(f))}
                      onKeyDown={keyTap(() => tapFormula(f))}
                    >
                      <span className="sm-fsyms">{f.kinds.map((k, i) => <img key={i} src={symbolUrl(KIND_CLASS[k])} alt="" draggable={false} />)}</span>
                      <span className="sm-fex">{f.example}</span>
                      <span className="sm-fline"><strong>{f.code}</strong> {formulaWords(f)}</span>
                    </div>
                  </div>
                ))}
                {!shownFormulas.length && <p className="sm-tray-note">No formula matches.</p>}
              </div>
            </Category>

            <Category label="Grammar Symbols" color="#E5B9E0" open={open.symbols} onToggle={() => setOpen((o) => ({ ...o, symbols: !o.symbols }))}>
              <div className="row-wrap sm-tiles">{SYMBOLS.filter((p) => symbolMatch(p.name, p.note)).map((p) => tile(p))}</div>
            </Category>

            <Category label="Helper Words" color="#FDE68A" open={open.helpers} onToggle={() => setOpen((o) => ({ ...o, helpers: !o.helpers }))}>
              <div className="row-wrap sm-tiles">{HELPERS.filter((p) => symbolMatch(p.name, p.note)).map((p) => tile(p, true))}</div>
            </Category>

            <Category label="Additional Symbols" color="#E2E8F0" open={open.tense} onToggle={() => setOpen((o) => ({ ...o, tense: !o.tense }))}>
              <div className="row-wrap sm-tiles">
                {TENSES.map((tn) => (
                  <div key={tn} className="lm-tense-tray">
                    <div
                      role="button"
                      tabIndex={0}
                      className="sm-tile"
                      aria-label={`${TENSE_SYMBOLS[tn].name}: drag onto a sentence, or press Enter for the selected sentence`}
                      onPointerDown={startDrag({ type: 'tense', tense: tn }, TENSE_SYMBOLS[tn].name, TENSE_SYMBOLS[tn].imageUrl)}
                      onClick={tap(() => updateRow(act, (s) => ({ ...s, tense: tn })))}
                      onKeyDown={keyTap(() => updateRow(act, (s) => ({ ...s, tense: tn })))}
                    >
                      <img src={TENSE_SYMBOLS[tn].imageUrl} alt="" draggable={false} />
                    </div>
                    <span>{TENSE_SYMBOLS[tn].name}</span>
                  </div>
                ))}
              </div>
            </Category>
          </aside>
        )}

        <main className="sm-main" ref={mainRef}>
          <section className="sm-video" aria-label="Video" style={{ height: videoH }}>
            <div className="sm-frame" style={{ width: `min(100%, ${Math.round(((videoH - 44) * 16) / 9)}px)` }}>
              <div className="sm-screen">
                <canvas ref={canvasRef} width={VIDEO_W} height={VIDEO_H} role="img" aria-label={shownClip ? `Video: ${shownClip.text}` : 'Video: blank'} />
                {!shownClip && <div className="sm-blank" aria-hidden="true"><span className="sm-blank-icon">▶</span></div>}
              </div>
              <div className="sm-captions">
                {shownClip?.words.map((w, i) => (
                  <span key={i} className={i === caption.active ? 'on' : ''} style={{ ['--c' as string]: GRAMMAR_SYMBOL_INFO[w.cls].color }}>{w.text}</span>
                ))}
              </div>
            </div>
          </section>

          <div
            className="sm-splitter"
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize the video"
            aria-valuenow={Math.round(videoH)}
            tabIndex={0}
            onPointerDown={startResize}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp') { e.preventDefault(); setVideoH((h) => clampH(h - 24)); }
              if (e.key === 'ArrowDown') { e.preventDefault(); setVideoH((h) => clampH(h + 24)); }
            }}
          >
            <span />
          </div>

          <section className="sm-doc" aria-label="My story">
            <ol className="sm-lines">
              {data.map((d, r) => {
                const s = d.row.s;
                const a = d.a;
                const isActive = r === act;
                const over = drag?.target && 'row' in drag.target && drag.target.row === r ? drag.target : null;
                const lineDrop = drag?.target && 'lines' in drag.target ? drag.target.lines : -1;
                return (
                  <li
                    key={d.row.id}
                    ref={(el) => { rowEls.current[r] = el; }}
                    className={`sm-ln${isActive ? ' active' : ''}${over ? ' over' : ''}${a.status === 'error' ? ' bad' : ''}${lineDrop === r ? ' drop-before' : ''}${lineDrop === rows.length && r === rows.length - 1 ? ' drop-after' : ''}`}
                    onPointerDown={() => setActive(r)}
                    onFocus={() => setActive(r)}
                  >
                    <button
                      type="button"
                      className="sm-handle"
                      onPointerDown={startDrag({ type: 'line', row: r }, a.text || `Sentence ${r + 1}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp') { e.preventDefault(); swapRows(r, r - 1); }
                        if (e.key === 'ArrowDown') { e.preventDefault(); swapRows(r, r + 1); }
                      }}
                      aria-label={`Sentence ${r + 1}. Drag to move it, or use the arrow keys.`}
                      title="Drag to move this sentence"
                    >⠿</button>
                    <div className="sm-words">
                      {s.tokens.map((tok, i) => {
                        const cls = KIND_CLASS[tok.kind];
                        const ws = a.words.filter((w) => w.idx === i);
                        const wordTense = ws.find((w) => w.tense)?.tense;
                        const ch = choices[r]?.[i] ?? null;
                        const label = `Sentence ${r + 1}, ${KIND_LABEL[tok.kind]} ${i + 1}`;
                        const color = GRAMMAR_SYMBOL_INFO[cls].color;
                        const punct = ws.length ? (ws[ws.length - 1].text.match(/[.,!]$/)?.[0] ?? '') : '';
                        const capFirst = ws[0]?.text && /^[A-Z]/.test(ws[0].text);
                        // Each dropdown is as wide as its word, so the line reads like normal text.
                        const fit = (t: string | undefined) => ({ width: `${Math.max(2.2, (t ?? '___').replace(/[.,!]$/, '').length * 0.62 + 0.9)}em` });
                        return (
                          <span key={tok.id} className="sm-wwrap">
                            {over && over.at === i && drag?.item.type !== 'formula' && drag?.item.type !== 'tense' && <span className="sm-caret" aria-hidden="true" />}
                            <span ref={(el) => { if (el) slotEls.current.set(`${r}:${i}`, el); else slotEls.current.delete(`${r}:${i}`); }} className={`sm-w${needsPick(tok.kind) && (!tok.value || (tok.kind === 'phrase' && !tok.place)) ? ' blank' : ''}`} style={{ ['--c' as string]: color }}>
                              <span
                                className="sm-sym"
                                role="button"
                                tabIndex={-1}
                                onPointerDown={startDrag({ type: 'slot', row: r, index: i }, KIND_LABEL[tok.kind], symbolUrl(cls))}
                                title={GRAMMAR_SYMBOL_INFO[cls].name}
                              >
                                <img src={symbolUrl(cls)} alt="" draggable={false} />
                                {wordTense && <img className="sm-tense-mark" src={TENSE_SYMBOLS[wordTense].imageUrl} alt="" draggable={false} />}
                              </span>
                              <span className="sm-wtext">
                                {tok.kind === 'phrase' && ch && 'preps' in ch ? (
                                  <>
                                    <select style={fit(ws[0]?.text)} className={capFirst ? 'cap' : ''} aria-label={`${label}: preposition`} value={tok.value ?? ''} onChange={(e) => setToken(r, i, { value: e.target.value || undefined })} disabled={!tok.place}>
                                      <option value="">___</option>
                                      {ch.preps.map((p) => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                    <span className="sm-fixedw">the</span>
                                    <select style={fit(ws[2]?.text)} aria-label={`${label}: place`} value={tok.place ?? ''} onChange={(e) => setToken(r, i, { place: e.target.value || undefined, value: undefined })}>
                                      <option value="">___</option>
                                      {ch.places.map((p) => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                  </>
                                ) : ch && 'list' in ch ? (
                                  <select style={fit(ws.map((w) => w.text).join(' '))} className={capFirst ? 'cap' : ''} aria-label={label} value={tok.value ?? ''} onChange={(e) => setToken(r, i, { value: e.target.value || undefined })}>
                                    <option value="">___</option>
                                    {ch.list.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                                  </select>
                                ) : (
                                  <span className="sm-fixedw">{ws.map((w) => w.text.replace(/[.,!]$/, '')).join(' ')}</span>
                                )}
                                {punct && <span className="sm-punct">{punct}</span>}
                              </span>
                              <span className="sm-wtools">
                                {needsPick(tok.kind) && <button type="button" onClick={() => updateRow(r, (st) => rollToken(st, i, d.before))} aria-label={`Roll a new ${KIND_LABEL[tok.kind]}`} title="Roll"><Die /></button>}
                                <button type="button" onClick={() => updateRow(r, (st) => ({ ...st, tokens: st.tokens.filter((_, j) => j !== i) }))} aria-label={`Remove ${label}`} title="Remove">×</button>
                              </span>
                            </span>
                          </span>
                        );
                      })}
                      {over && over.at === s.tokens.length && s.tokens.length > 0 && drag?.item.type !== 'formula' && drag?.item.type !== 'tense' && <span className="sm-caret end" aria-hidden="true" />}
                      {a.status === 'error' && <span className="sm-hint" role="note">{a.hint}</span>}
                    </div>
                    <div className="sm-ltools">
                      <span className="sm-tense" role="radiogroup" aria-label={`Sentence ${r + 1} time`}>
                        {TENSES.map((tn) => (
                          <button
                            key={tn}
                            type="button"
                            role="radio"
                            aria-checked={a.tense === tn}
                            aria-label={TENSE_SYMBOLS[tn].name}
                            className={a.tense === tn ? 'on' : ''}
                            disabled={!!a.lockedTense && a.lockedTense !== tn}
                            title={TENSE_SYMBOLS[tn].name}
                            onClick={() => updateRow(r, (st) => ({ ...st, tense: tn }))}
                          >
                            <img src={TENSE_SYMBOLS[tn].imageUrl} alt="" draggable={false} />
                          </button>
                        ))}
                      </span>
                      <button type="button" className="sm-mini" onClick={() => updateRow(r, (st) => rollAll(st, d.before))} disabled={!s.tokens.length} aria-label={`Roll every word in sentence ${r + 1}`} title="Roll every word"><Die /></button>
                      <button type="button" className="sm-mini" onClick={() => speak(a.text)} disabled={a.status !== 'ok'} aria-label={`Read sentence ${r + 1} aloud`} title="Read aloud">🔈</button>
                      {a.canContract && <button type="button" className={`sm-mini sm-wide${s.contract ? ' on' : ''}`} aria-pressed={s.contract} onClick={() => updateRow(r, (st) => ({ ...st, contract: !st.contract }))} title="Contraction">n&apos;t</button>}
                      <button type="button" className="sm-mini" onClick={() => removeRow(r)} aria-label={`Delete sentence ${r + 1}`} title="Delete">×</button>
                    </div>
                  </li>
                );
              })}
            </ol>
            <div
              ref={newZone}
              className={`sm-rest${drag?.target && 'row' in drag.target && drag.target.row === 'new' ? ' over' : ''}`}
              onClick={() => { if (rows[rows.length - 1]?.s.tokens.length) addRowWith((s) => s); else setActive(rows.length - 1); }}
              aria-hidden="true"
            />
          </section>
        </main>
      </div>

      {showHelp && (
        <div className="sm-modal" role="dialog" aria-modal="true" aria-labelledby="sm-help-title" onClick={(e) => { if (e.target === e.currentTarget) setShowHelp(false); }} onKeyDown={(e) => { if (e.key === 'Escape') setShowHelp(false); }}>
          <div className="sm-modal-card sm-help-card">
            <h2 id="sm-help-title">How Story Maker works</h2>
            <ol className="sm-steps">
              <li><span>1</span><div><strong>Pick a formula.</strong> Drag a formula card from the left onto the page, or click its <strong>+</strong>. It comes filled in with its example sentence. You can also drag single grammar symbols in and snap them together.</div></li>
              <li><span>2</span><div><strong>Fill each blank.</strong> Click any word to pick a different one, or roll the dice. The dice only pick words the video can act out.</div></li>
              <li><span>3</span><div><strong>Watch the meaning.</strong> Every word changes the video: <em>quickly</em> runs fast, <em>slowly</em> creeps, <em>big</em> grows, <em>sad</em> brings a rain cloud.</div></li>
              <li><span>4</span><div><strong>Choose the time.</strong> Past, Present or Future changes the verb and the look of the video. Drop a tense symbol on a sentence, or click one beside it.</div></li>
              <li><span>5</span><div><strong>Make a story.</strong> Each sentence is its own line; drag ⠿ to put them in a new order. He, she, it and they keep talking about the same characters. Click 🔈 to hear a sentence, Play to watch the story, and Save video to download it.</div></li>
            </ol>
            <button type="button" className="btn btn-sm btn-primary" autoFocus onClick={() => setShowHelp(false)}>Got it</button>
          </div>
        </div>
      )}

      {drag && (
        <div className="sm-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          {drag.img && <img src={drag.img} alt="" />}
          <span>{drag.label}</span>
        </div>
      )}

      {rec && (
        <div className="sm-modal" role="dialog" aria-modal="true" aria-label="Saving video">
          <div className="sm-modal-card">
            <h2>Making your video</h2>
            <p>Keep this tab open. It plays once while it records, as a vertical video.</p>
            <div className="sm-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(rec.progress * 100)}>
              <span style={{ width: `${Math.round(rec.progress * 100)}%` }} />
            </div>
            <button type="button" className="btn btn-sm" onClick={() => { cancelRec.current = true; }}>Cancel</button>
          </div>
        </div>
      )}
      {recError && <p className="sm-toast" role="alert">{recError} <button type="button" onClick={() => setRecError('')} aria-label="Close">×</button></p>}
    </div>
  );
}

function Die() {
  return (
    <svg className="sm-die" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="4" fill="#fff" stroke="currentColor" strokeWidth="2" />
      <circle cx="8" cy="8" r="1.6" fill="currentColor" /><circle cx="16" cy="16" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" /><circle cx="16" cy="8" r="1.6" fill="currentColor" /><circle cx="8" cy="16" r="1.6" fill="currentColor" />
    </svg>
  );
}
