import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HomeButton } from '../HomeButton';
import { GRAMMAR_SYMBOL_INFO, TENSE_SYMBOLS, type SymbolWordClass } from '../../lib/grammarSymbols';
import { useFontChoice } from '../../lib/fontChoice';
import { buildUtterance } from '../../lib/tts';
import {
  analyze, baseChoices, choicesFor, EMPTY_CONTEXT, formulaTokens, KIND_CLASS, KIND_LABEL, needsPick, nextContext, placeChoices, prepChoices,
  rollAll, rollToken, storyFormulas, uid,
  type Analysis, type Kind, type SentenceState, type StoryContext, type StoryFormula, type Token,
} from '../../lib/story/grammar';
import { drawExportFrame, drawScene, EXPORT_H, EXPORT_W, HI, makeClip, SH, SW, wordAt, type Assets, type Clip } from '../../lib/story/render';
import type { Tense } from '../../lib/story/words';
import './storyMaker.css';

// Story Maker (her request 2026-11-17): build sentences from her formulas and grammar symbols, Mad Lib style, and
// watch a pixel video act out exactly what the words mean. Sentences add up to a story; Play reads it aloud; the
// story saves to the device as a vertical video. Nothing is stored online.

interface StoryItem { id: string; s: SentenceState }
type DragItem = { type: 'kind'; kind: Kind } | { type: 'formula'; f: StoryFormula } | { type: 'slot'; index: number };
interface DragState { item: DragItem; label: string; img?: string; x: number; y: number; over: number | null; inside: boolean }

const TENSES: Tense[] = ['past', 'present', 'future'];
const EMPTY: SentenceState = { tokens: [], tense: 'past', contract: false };

const PALETTE: { kind: Kind; cls: SymbolWordClass; name: string; note: string }[] = [
  { kind: 'article', cls: 'article', name: 'Article', note: 'a, an, the' },
  { kind: 'adjective', cls: 'adjective', name: 'Adjective', note: 'describes a noun' },
  { kind: 'noun', cls: 'noun', name: 'Noun', note: 'person, place, thing, animal' },
  { kind: 'propernoun', cls: 'propernoun', name: 'Proper noun', note: 'a name' },
  { kind: 'pronoun', cls: 'pronoun', name: 'Pronoun', note: 'I, he, she, they' },
  { kind: 'verb', cls: 'verb', name: 'Verb', note: 'action word' },
  { kind: 'adverb', cls: 'adverb', name: 'Adverb', note: 'how, when, where' },
  { kind: 'phrase', cls: 'preposition', name: 'Prepositional phrase', note: 'to the park' },
  { kind: 'conj', cls: 'conjunction', name: 'Conjunction', note: 'and, but, so' },
  { kind: 'interjection', cls: 'interjection', name: 'Interjection', note: 'Wow! Oops!' },
];
const HELPERS: { kind: Kind; cls: SymbolWordClass; name: string; note: string }[] = [
  { kind: 'will', cls: 'verb', name: 'will', note: 'makes it future' },
  { kind: 'be', cls: 'verb', name: 'be', note: 'am, is, are, was, were' },
  { kind: 'do', cls: 'verb', name: 'do', note: 'do, does, did' },
  { kind: 'not', cls: 'adverb', name: 'not', note: 'the opposite' },
];

const symbolUrl = (cls: SymbolWordClass) => GRAMMAR_SYMBOL_INFO[cls].imageUrl;

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
function fade(h: CanvasRenderingContext2D, t: number, d: number) {
  const a = t < 0.2 ? 1 - t / 0.2 : t > d - 0.25 ? (t - (d - 0.25)) / 0.25 : 0;
  if (a <= 0) return;
  h.save(); h.globalAlpha = Math.min(1, a); h.fillStyle = '#0F2B45'; h.fillRect(0, 0, SW * HI, SH * HI); h.restore();
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

export function StoryMaker() {
  const { font, setFont } = useFontChoice();
  const assets = useAssets();
  const formulas = useMemo(() => storyFormulas(), []);
  const [sentence, setSentence] = useState<SentenceState>(EMPTY);
  const [story, setStory] = useState<StoryItem[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [tab, setTab] = useState<'formulas' | 'symbols'>('formulas');
  const [query, setQuery] = useState('');
  const [readAloud, setReadAloud] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [rec, setRec] = useState<{ progress: number } | null>(null);
  const [recError, setRecError] = useState('');
  const [drag, setDrag] = useState<DragState | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [caption, setCaption] = useState<{ key: string; active: number }>({ key: '', active: -1 });

  /* ---- The story so far, and the sentence being built ---- */
  const storyData = useMemo(() => {
    const out: { item: StoryItem; a: Analysis; clip: Clip | null; before: StoryContext; after: StoryContext }[] = [];
    for (const item of story) {
      const before = out.length ? out[out.length - 1].after : EMPTY_CONTEXT;
      const a = analyze(item.s, before);
      out.push({ item, a, clip: a.status === 'ok' ? makeClip(a, before) : null, before, after: nextContext(before, a) });
    }
    return out;
  }, [story]);
  const ctxNow: StoryContext = editing !== null ? (storyData[editing]?.before ?? EMPTY_CONTEXT) : (storyData[storyData.length - 1]?.after ?? EMPTY_CONTEXT);
  const analysis: Analysis = useMemo(() => analyze(sentence, ctxNow), [sentence, ctxNow]);
  const clip: Clip | null = useMemo(() => (analysis.status === 'ok' ? makeClip(analysis, ctxNow) : null), [analysis, ctxNow]);
  const playlist = useMemo(() => {
    const list = storyData.map((d) => ({ clip: d.clip, code: d.a.code })).filter((x): x is { clip: Clip; code: string | null } => !!x.clip);
    if (!list.length && clip) return [{ clip, code: analysis.code }];
    return list;
  }, [storyData, clip, analysis.code]);
  const totalSeconds = playlist.reduce((s, x) => s + x.clip.duration, 0);

  /* ---- The video ---- */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ clip, playlist, playing, readAloud, idlePlace: ctxNow.place ?? 'meadow', start: 0, lastIdx: -1, capKey: '', capActive: -1 });
  const idlePlace = ctxNow.place ?? 'meadow';
  useEffect(() => {
    Object.assign(live.current, { clip, playlist, playing, readAloud, idlePlace });
  }, [clip, playlist, playing, readAloud, idlePlace]);

  useEffect(() => {
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const cv = canvasRef.current;
      const h = cv?.getContext('2d');
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
        if (idx !== L.lastIdx) { L.lastIdx = idx; if (L.readAloud) speak(shown.text); }
        drawScene(h, shown, t, assets);
        fade(h, t, shown.duration);
      } else if (L.clip) {
        shown = L.clip; t = (now / 1000) % L.clip.duration;
        drawScene(h, shown, t, assets);
      } else {
        drawScene(h, null, now / 1000, assets, L.idlePlace);
      }
      const key = shown ? shown.text : '';
      const active = shown ? wordAt(t, shown.words.length) : -1;
      if (key !== L.capKey || active !== L.capActive) { L.capKey = key; L.capActive = active; setCaption({ key, active }); }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [assets]);

  const shownClip = playing ? playlist.find((p) => p.clip.text === caption.key)?.clip ?? null : clip;

  const play = () => {
    if (playing) { setPlaying(false); window.speechSynthesis?.cancel(); return; }
    if (!playlist.length) return;
    live.current.start = performance.now();
    live.current.lastIdx = -1;
    setPlaying(true);
  };

  /* ---- Saving the video ---- */
  const cancelRec = useRef(false);
  const saveVideo = async () => {
    setRecError('');
    const fmt = pickMime();
    if (!fmt || !playlist.length) { setRecError('This browser cannot save video. Try Chrome, Edge or Safari.'); return; }
    setPlaying(false);
    window.speechSynthesis?.cancel();
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
        const a = e < 0.2 ? 1 - e / 0.2 : e > c.duration - 0.25 ? (e - (c.duration - 0.25)) / 0.25 : 0;
        if (a > 0) { h.save(); h.globalAlpha = Math.min(1, a); h.fillStyle = '#0F2B45'; h.fillRect(0, 0, EXPORT_W, EXPORT_H); h.restore(); }
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

  /* ---- Building ---- */
  const setTokens = (tokens: Token[], extra: Partial<SentenceState> = {}) => setSentence((s) => ({ ...s, ...extra, tokens }));
  const applyFormula = (f: StoryFormula) => setSentence((s) => ({ ...s, tokens: formulaTokens(f), contract: f.contract, exclaim: f.exclaim }));
  const insertKind = (kind: Kind, at?: number) => setSentence((s) => {
    const tokens = [...s.tokens];
    tokens.splice(at ?? tokens.length, 0, { id: uid(), kind, value: kind === 'conj' ? 'and' : undefined });
    return { ...s, tokens, exclaim: false };
  });
  const moveToken = (from: number, to: number) => setSentence((s) => {
    const tokens = [...s.tokens];
    const [x] = tokens.splice(from, 1);
    tokens.splice(to > from ? to - 1 : to, 0, x);
    return { ...s, tokens };
  });
  const removeToken = (i: number) => setTokens(sentence.tokens.filter((_, j) => j !== i));
  const setToken = (i: number, patch: Partial<Token>) => setTokens(sentence.tokens.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const addToStory = () => {
    if (analysis.status !== 'ok') return;
    if (editing !== null) {
      setStory((st) => st.map((it, i) => (i === editing ? { ...it, s: sentence } : it)));
      setEditing(null);
    } else setStory((st) => [...st, { id: uid(), s: sentence }]);
    setSentence((s) => ({ ...s, tokens: s.tokens.map((x) => (x.kind === 'conj' ? x : { ...x, value: undefined, place: undefined })) }));
  };
  const editItem = (i: number) => { setEditing(i); setSentence(story[i].s); };
  const cancelEdit = () => { setEditing(null); setSentence((s) => ({ ...s, tokens: [] })); };

  /* ---- Drag and drop (mouse, pen, and a long press on touch) ---- */
  const builderRef = useRef<HTMLDivElement>(null);
  const slotEls = useRef<(HTMLDivElement | null)[]>([]);
  const justDragged = useRef(false);

  const hitTest = useCallback((x: number, y: number): { over: number | null; inside: boolean } => {
    const b = builderRef.current?.getBoundingClientRect();
    const inside = !!b && x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
    if (!inside) return { over: null, inside };
    const els = slotEls.current.slice(0, sentence.tokens.length);
    let best = { d: Infinity, idx: els.length };
    els.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const d = Math.abs(y - cy) * 3 + Math.abs(x - cx);
      if (d < best.d) best = { d, idx: x < cx ? i : i + 1 };
    });
    return { over: best.idx, inside };
  }, [sentence.tokens.length]);

  const drop = (item: DragItem, hit: { over: number | null; inside: boolean }) => {
    if (!hit.inside) return;
    if (item.type === 'formula') applyFormula(item.f);
    else if (item.type === 'kind') insertKind(item.kind, hit.over ?? undefined);
    else if (hit.over !== null && hit.over !== item.index && hit.over !== item.index + 1) moveToken(item.index, hit.over);
  };

  const startDrag = (item: DragItem, label: string, img?: string) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const sx = e.clientX;
    const sy = e.clientY;
    const touch = e.pointerType === 'touch';
    let started = false;
    let cancelled = false;
    let timer = 0;
    const begin = (x: number, y: number) => { started = true; setDrag({ item, label, img, x, y, ...hitTest(x, y) }); };
    if (touch) timer = window.setTimeout(() => { if (!cancelled) begin(sx, sy); }, 300);
    const block = (ev: TouchEvent) => { if (started) ev.preventDefault(); };
    const move = (ev: PointerEvent) => {
      const far = Math.hypot(ev.clientX - sx, ev.clientY - sy) > 7;
      if (!started) {
        if (touch) { if (far) { cancelled = true; cleanup(); } return; }
        if (!far) return;
        begin(ev.clientX, ev.clientY);
      }
      setDrag((d) => (d ? { ...d, x: ev.clientX, y: ev.clientY, ...hitTest(ev.clientX, ev.clientY) } : d));
    };
    const up = (ev: PointerEvent) => {
      cleanup();
      if (started) {
        drop(item, hitTest(ev.clientX, ev.clientY));
        setDrag(null);
        justDragged.current = true;
        setTimeout(() => { justDragged.current = false; }, 50);
      }
    };
    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('touchmove', block);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('touchmove', block, { passive: false });
  };
  const clickUnlessDragged = (fn: () => void) => () => { if (!justDragged.current) fn(); };

  /* ---- Dropdown choices for every blank ---- */
  type Ch = { preps: string[]; places: string[] } | { list: { value: string; label: string }[] } | null;
  const choices = useMemo(() => sentence.tokens.map((tok, i): Ch => {
    if (tok.kind === 'phrase') return { preps: prepChoices(sentence, i, ctxNow), places: placeChoices(sentence, i, ctxNow) };
    if (tok.kind === 'conj') return { list: baseChoices('conj') };
    if (!needsPick(tok.kind)) return null;
    const list = choicesFor(sentence, i, ctxNow);
    const all = baseChoices(tok.kind);
    if (tok.value && !list.some((c) => c.value === tok.value)) list.unshift(all.find((c) => c.value === tok.value) ?? { value: tok.value, label: tok.value });
    return { list };
  }), [sentence, ctxNow]);

  const filtered = formulas.filter((f) => !query.trim() || f.code.toLowerCase().includes(query.trim().toLowerCase()) || f.formula.includes(query.trim().toLowerCase()));
  const wordsFor = (i: number) => analysis.words.filter((w) => w.idx === i);

  const status = analysis.status;
  const lockedWhy = analysis.lockedTense
    ? sentence.tokens.some((x) => x.kind === 'will') ? 'will makes it future' : `${sentence.tokens.find((x) => x.kind === 'adverb' && ['yesterday', 'tomorrow'].includes(x.value ?? ''))?.value ?? 'the time word'} sets the time`
    : '';

  return (
    <div className={`sm-page${drag ? ' sm-dragging' : ''}`}>
      <header className="sm-header">
        <HomeButton />
        <div className="sm-title">
          <h1>Story Maker</h1>
          <p>Build a sentence. Watch it come to life.</p>
        </div>
        <div className="sm-header-actions">
          <button type="button" className={`sm-chip${font === 'dyslexic' ? ' on' : ''}`} aria-pressed={font === 'dyslexic'} onClick={() => setFont(font === 'dyslexic' ? 'inclusive' : 'dyslexic')}>
            <span aria-hidden="true" className="sm-dys">Aa</span> OpenDyslexic
          </button>
          <button type="button" className={`sm-chip${readAloud ? ' on' : ''}`} aria-pressed={readAloud} onClick={() => setReadAloud((v) => !v)}>
            <span aria-hidden="true">🔈</span> Read while playing
          </button>
          <button type="button" className="sm-chip" aria-expanded={showHelp} onClick={() => setShowHelp((v) => !v)}>How it works</button>
        </div>
      </header>

      {showHelp && (
        <section className="sm-help" aria-label="How Story Maker works">
          <ol>
            <li><strong>Start with a formula.</strong> Drag a formula card into the sentence, or tap it. You can also drag single grammar symbols in and snap them together.</li>
            <li><strong>Fill each blank.</strong> Pick a word from the dropdown, or roll the dice. The dice only pick words the video can act out.</li>
            <li><strong>Watch the meaning.</strong> Every word changes the video: <em>quickly</em> runs fast, <em>slowly</em> creeps, <em>big</em> grows, <em>sad</em> brings a rain cloud.</li>
            <li><strong>Choose the time.</strong> Past, Present or Future changes the verb and the look of the video.</li>
            <li><strong>Make a story.</strong> Add each sentence to the story. Use he, she, it or they to keep talking about the same characters. Press Play, then Save video.</li>
          </ol>
          <button type="button" className="sm-btn" onClick={() => setShowHelp(false)}>Got it</button>
        </section>
      )}

      <div className="sm-app">
        <aside className="sm-palette" aria-label="Formulas and symbols">
          <div className="sm-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'formulas'} className={tab === 'formulas' ? 'on' : ''} onClick={() => setTab('formulas')}>Formulas</button>
            <button type="button" role="tab" aria-selected={tab === 'symbols'} className={tab === 'symbols' ? 'on' : ''} onClick={() => setTab('symbols')}>Symbols</button>
          </div>
          {tab === 'formulas' ? (
            <>
              <label className="sm-sr" htmlFor="sm-search">Find a formula</label>
              <input id="sm-search" className="sm-search" type="search" placeholder="Find a formula code" value={query} onChange={(e) => setQuery(e.target.value)} />
              <p className="sm-hint">Drag a formula into the sentence, or tap it.</p>
              <ul className="sm-formulas">
                {filtered.map((f) => (
                  <li key={`${f.code}|${f.kinds.join(' ')}`}>
                    <button
                      type="button"
                      className="sm-formula"
                      onPointerDown={startDrag({ type: 'formula', f }, f.code)}
                      onClick={clickUnlessDragged(() => applyFormula(f))}
                      aria-label={`Use formula ${f.code}: ${f.formula}`}
                    >
                      <span className="sm-code">{f.code}</span>
                      <span className="sm-symrow" aria-hidden="true">
                        {f.kinds.map((k, i) => <img key={i} src={symbolUrl(KIND_CLASS[k])} alt="" draggable={false} />)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {!filtered.length && <p className="sm-hint">No formula matches that code.</p>}
            </>
          ) : (
            <>
              <p className="sm-hint">Drag a symbol into the sentence to snap it in, or tap it to add it at the end.</p>
              <div className="sm-symbols">
                {PALETTE.map((p) => (
                  <button key={p.kind} type="button" className="sm-symbol" onPointerDown={startDrag({ type: 'kind', kind: p.kind }, p.name, symbolUrl(p.cls))} onClick={clickUnlessDragged(() => insertKind(p.kind))}>
                    <img src={symbolUrl(p.cls)} alt="" draggable={false} />
                    <span><strong>{p.name}</strong><small>{p.note}</small></span>
                  </button>
                ))}
              </div>
              <h3 className="sm-subhead">Helper words</h3>
              <div className="sm-symbols">
                {HELPERS.map((p) => (
                  <button key={p.kind} type="button" className="sm-symbol" onPointerDown={startDrag({ type: 'kind', kind: p.kind }, p.name, symbolUrl(p.cls))} onClick={clickUnlessDragged(() => insertKind(p.kind))}>
                    <img src={symbolUrl(p.cls)} alt="" draggable={false} />
                    <span><strong>{p.name}</strong><small>{p.note}</small></span>
                  </button>
                ))}
              </div>
            </>
          )}
        </aside>

        <main className="sm-phone">
          <section className="sm-video" aria-label="Video">
            <canvas ref={canvasRef} width={SW * HI} height={SH * HI} role="img" aria-label={shownClip ? `Video: ${shownClip.text}` : 'Video: waiting for a sentence'} />
            <div className="sm-video-top">
              <button type="button" className="sm-play" onClick={play} disabled={!playlist.length || !!rec} aria-label={playing ? 'Stop' : story.length ? 'Play the story' : 'Play'}>
                {playing ? <span className="sm-stop" aria-hidden="true" /> : <span className="sm-tri" aria-hidden="true" />}
                <span>{playing ? 'Stop' : story.length ? 'Play story' : 'Play'}</span>
              </button>
              <button type="button" className="sm-save" onClick={() => void saveVideo()} disabled={!playlist.length || !!rec}>Save video</button>
            </div>
            {shownClip ? (
              <p className="sm-captions" aria-live="off">
                {shownClip.words.map((w, i) => (
                  <span key={i} className={i === caption.active ? 'on' : ''} style={{ ['--c' as string]: GRAMMAR_SYMBOL_INFO[w.cls].color }}>{w.text}</span>
                ))}
              </p>
            ) : (
              <p className={`sm-captions sm-status sm-status-${status}`}>
                {status === 'empty' && 'Drag a formula into the sentence below to start.'}
                {status === 'incomplete' && 'Pick a word for every blank, or roll the dice.'}
                {status === 'error' && <><strong>Sentence not recognized.</strong> {analysis.hint}</>}
              </p>
            )}
          </section>

          <section className="sm-builder" aria-label="Sentence builder">
            <div className="sm-builder-head">
              <span className={`sm-code-pill${analysis.code ? '' : ' own'}`}>
                {status === 'ok' ? (analysis.code ?? 'My own formula') : analysis.code ?? (sentence.tokens.length ? 'Building...' : 'No formula yet')}
              </span>
              <div className="sm-tense" role="radiogroup" aria-label="Time">
                {TENSES.map((tn) => (
                  <button
                    key={tn}
                    type="button"
                    role="radio"
                    aria-checked={analysis.tense === tn}
                    className={analysis.tense === tn ? 'on' : ''}
                    disabled={!!analysis.lockedTense && analysis.lockedTense !== tn}
                    title={analysis.lockedTense && analysis.lockedTense !== tn ? lockedWhy : undefined}
                    onClick={() => setSentence((s) => ({ ...s, tense: tn }))}
                  >
                    <img src={TENSE_SYMBOLS[tn].imageUrl} alt="" draggable={false} />{TENSE_SYMBOLS[tn].name}
                  </button>
                ))}
              </div>
            </div>

            <div ref={builderRef} className={`sm-slots${drag?.inside ? ' over' : ''}${drag?.inside && drag.item.type === 'formula' ? ' replace' : ''}`}>
              {!sentence.tokens.length && <p className="sm-empty">Drop a formula or a symbol here</p>}
              {sentence.tokens.map((tok, i) => {
                const cls = KIND_CLASS[tok.kind];
                const ws = wordsFor(i);
                const wordTense = ws.find((w) => w.tense)?.tense;
                const ch = choices[i];
                const label = `${KIND_LABEL[tok.kind]} ${i + 1}`;
                return (
                  <div key={tok.id} className="sm-slot-wrap">
                    {drag?.over === i && drag.item.type !== 'formula' && <span className="sm-caret" aria-hidden="true" />}
                    <div ref={(el) => { slotEls.current[i] = el; }} className={`sm-slot sm-slot-${cls}${needsPick(tok.kind) && !tok.value ? ' blank' : ''}`}>
                      <button
                        type="button"
                        className="sm-grip"
                        onPointerDown={startDrag({ type: 'slot', index: i }, KIND_LABEL[tok.kind], symbolUrl(cls))}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); moveToken(i, i - 1); }
                          if (e.key === 'ArrowRight' && i < sentence.tokens.length - 1) { e.preventDefault(); moveToken(i, i + 2); }
                        }}
                        aria-label={`${label}. Drag to move, or use the arrow keys.`}
                        title={GRAMMAR_SYMBOL_INFO[cls].name}
                      >
                        <img src={symbolUrl(cls)} alt="" draggable={false} />
                        {wordTense && <img className="sm-tense-mark" src={TENSE_SYMBOLS[wordTense].imageUrl} alt="" draggable={false} />}
                      </button>
                      <span className="sm-slot-kind">{tok.kind === 'phrase' ? 'phrase' : KIND_LABEL[tok.kind].split(' (')[0]}</span>
                      {tok.kind === 'phrase' && ch && 'preps' in ch ? (
                        <div className="sm-phrase">
                          <select aria-label={`${label}: preposition`} value={tok.value ?? ''} onChange={(e) => setToken(i, { value: e.target.value || undefined })} disabled={!tok.place}>
                            <option value="">{tok.place ? 'pick' : '...'}</option>
                            {ch.preps.map((p) => <option key={p} value={p}>{p}</option>)}
                          </select>
                          <span>the</span>
                          <select aria-label={`${label}: place`} value={tok.place ?? ''} onChange={(e) => {
                            const place = e.target.value || undefined;
                            setToken(i, { place, value: undefined });
                          }}>
                            <option value="">place</option>
                            {ch.places.map((p) => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                      ) : ch && 'list' in ch ? (
                        <select aria-label={label} value={tok.value ?? ''} onChange={(e) => setToken(i, { value: e.target.value || undefined })}>
                          <option value="">choose</option>
                          {ch.list.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      ) : (
                        <span className="sm-fixed">{ws.map((w) => w.text.replace(/[.,!]$/, '')).join(' ') || <em>joined</em>}</span>
                      )}
                      <div className="sm-slot-actions">
                        {needsPick(tok.kind) && (
                          <button type="button" className="sm-mini" onClick={() => setSentence((s) => rollToken(s, i, ctxNow))} aria-label={`Roll a ${KIND_LABEL[tok.kind]}`} title="Roll the dice">
                            <Die />
                          </button>
                        )}
                        <button type="button" className="sm-mini" onClick={() => removeToken(i)} aria-label={`Remove ${label}`} title="Remove">×</button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {drag?.over === sentence.tokens.length && drag.item.type !== 'formula' && sentence.tokens.length > 0 && <span className="sm-caret end" aria-hidden="true" />}
            </div>

            <p className={`sm-sentence${status === 'ok' ? ' ok' : ''}`} aria-live="polite">{analysis.text || ' '}</p>

            <div className="sm-actions">
              <button type="button" className="sm-btn sm-dice" onClick={() => setSentence((s) => rollAll(s, ctxNow))} disabled={!sentence.tokens.length}>
                <Die /> Roll all
              </button>
              <button type="button" className="sm-btn" onClick={() => speak(analysis.text)} disabled={status !== 'ok'}>
                <span aria-hidden="true">🔈</span> Read aloud
              </button>
              {analysis.canContract && (
                <label className="sm-check">
                  <input type="checkbox" checked={sentence.contract} onChange={(e) => setSentence((s) => ({ ...s, contract: e.target.checked }))} />
                  Contraction
                </label>
              )}
              <span className="sm-grow" />
              {editing !== null && <button type="button" className="sm-btn ghost" onClick={cancelEdit}>Cancel</button>}
              <button type="button" className="sm-btn ghost" onClick={() => { setSentence((s) => ({ ...s, tokens: [] })); }} disabled={!sentence.tokens.length}>Clear</button>
              <button type="button" className="sm-btn primary" onClick={addToStory} disabled={status !== 'ok'}>
                {editing !== null ? `Update sentence ${editing + 1}` : 'Add to story'}
              </button>
            </div>

            <div className="sm-story">
              <div className="sm-story-head">
                <h2>My story</h2>
                <span>{story.length ? `${story.length} ${story.length === 1 ? 'sentence' : 'sentences'} · ${Math.round(totalSeconds)} seconds` : 'Add sentences to make a longer video.'}</span>
              </div>
              {story.length > 0 && (
                <ol className="sm-story-list">
                  {storyData.map((d, i) => (
                    <li key={d.item.id} className={editing === i ? 'editing' : ''}>
                      <span className="sm-num">{i + 1}</span>
                      <span className="sm-story-text">{d.a.text}{d.a.status !== 'ok' && <em> (not recognized here)</em>}</span>
                      <span className="sm-story-btns">
                        <button type="button" className="sm-mini" onClick={() => editItem(i)} aria-label={`Edit sentence ${i + 1}`} title="Edit">✎</button>
                        <button type="button" className="sm-mini" disabled={i === 0} onClick={() => setStory((s) => { const n = [...s]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })} aria-label={`Move sentence ${i + 1} earlier`} title="Move up">↑</button>
                        <button type="button" className="sm-mini" disabled={i === story.length - 1} onClick={() => setStory((s) => { const n = [...s]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; })} aria-label={`Move sentence ${i + 1} later`} title="Move down">↓</button>
                        <button type="button" className="sm-mini" onClick={() => { setStory((s) => s.filter((_, j) => j !== i)); if (editing === i) cancelEdit(); }} aria-label={`Delete sentence ${i + 1}`} title="Delete">×</button>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        </main>
      </div>

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
            <p>Keep this tab open. It plays once while it records.</p>
            <div className="sm-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(rec.progress * 100)}>
              <span style={{ width: `${Math.round(rec.progress * 100)}%` }} />
            </div>
            <button type="button" className="sm-btn ghost" onClick={() => { cancelRec.current = true; }}>Cancel</button>
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
