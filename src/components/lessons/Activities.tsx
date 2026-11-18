import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import type { SymbolWordClass } from 'symbolic-grammar-engine';
import { GRAMMAR_SYMBOL_INFO, TENSE_SYMBOLS } from '../../lib/grammarSymbols';
import { MASTER_FORMULAS } from '../../lib/writer/masterList';
import { wordsOfType } from '../../lib/wordsByType';
import { speak, stopSpeaking } from '../../lib/word-explorer/speech';
import { FormulaSymbols } from '../SentenceFormulas';
import { TemplateEditor, TemplateView } from '../procedures/TemplatePages';
import LiteracyManipulatives from '../../LiteracyManipulatives';
import {
  SYMBOL_ORDER, checkWritten, codeOf, formulaLabel, formulaRow, formulaSlots, num, sortSetup, splitArrow, splitBar, splitEq, str, strs, symbolByName,
  symbolName, symbolsOfSentence, syms, tensesOf, wordFits, type Resp, type SentenceResult,
} from '../../lib/lessons/check';
import { ENGINE_FIELDS, type Activity, type Field, type Lesson } from '../../lib/lessons/types';
import type { PageData, PageKind } from '../../lib/procedures/types';

// Every activity a Daily Lesson can hold, as students see and do it (big, touch first, for iPads), and the form
// that edits every detail of it in Edit mode. `interactive` is false when students only watch (they then see the
// teacher's own moves on the activity), and in the teacher's small previews of each student's work.

export interface ViewProps { a: Activity; resp: Resp; set: (r: Resp) => void; interactive: boolean; lesson?: Lesson; teacher?: boolean; quiet?: boolean }
// Marks show only after a student finishes a field (leaves it or taps Enter), never while they are still typing
// (Claudia's review, 2026-11-18). The teacher always sees them. On an Assessment tab (quiet) students see no marks.
function useSeen(p: ViewProps) {
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const show = (k: string) => !!p.teacher || (!p.quiet && seen.has(k));
  const done = (k: string) => ({ onBlur: () => setSeen((x) => new Set(x).add(k)), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter') setSeen((x) => new Set(x).add(k)); } });
  return { show, done };
}
const NOAUTO = { autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false } as const;

// ---------- small shared parts ----------
export function Say({ text, label = 'Read it aloud' }: { text: string; label?: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => () => stopSpeaking(), []);
  if (!text.trim()) return null;
  return (
    <button type="button" className={`ln-say${on ? ' on' : ''}`} aria-label={on ? 'Stop reading' : label} aria-pressed={on}
      onClick={() => { if (on) { stopSpeaking(); setOn(false); } else { setOn(true); speak(text, { onEnd: () => setOn(false) }); } }}>🔊</button>
  );
}
const Sym = ({ c, size = 56, label = false }: { c: SymbolWordClass; size?: number; label?: boolean }) => {
  const info = GRAMMAR_SYMBOL_INFO[c];
  if (!info) return null;
  return <span className="ln-sym"><img src={info.imageUrl} alt={info.name} width={size} height={size} />{label && <span style={{ color: info.color === '#F7B3CF' ? '#b0477a' : info.color }}>{info.name}</span>}</span>;
};
const Strip = ({ code }: { code: string }) => {
  const slots = formulaSlots(code);
  if (!slots.length) return <span className="ln-code">{code}</span>;
  return <span className="ln-strip"><FormulaSymbols slots={slots} labels /><span className="ln-code">{code}</span></span>;
};
const Mark = ({ ok }: { ok?: boolean }) => (ok == null ? null : <span className={`ln-mark ${ok ? 'yes' : 'no'}`} aria-label={ok ? 'Right' : 'Not yet'}>{ok ? '✓' : '•'}</span>);
function CheckLine({ r }: { r: SentenceResult | null }) {
  if (!r) return null;
  return (
    <span className="ln-checks">
      <span className={r.capital ? 'yes' : 'no'}>Capital letter</span>
      <span className={r.punctuation ? 'yes' : 'no'}>Punctuation</span>
      {r.formula != null && <span className={r.formula ? 'yes' : 'ask'}>{r.formula ? `Formula ${r.code}` : 'Formula: show your teacher'}</span>}
    </span>
  );
}
// The same order on every screen (teacher and students), from the activity's id.
function seeded(seed: string) { let h = 2166136261; for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shuffle<T>(list: T[], seed: string): T[] { const r = seeded(seed); const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const wordsOf = (s: string) => s.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);

// ---------- the activity screen ----------
export function ActivityView(p: ViewProps) {
  const { a } = p;
  return (
    <div className={`ln-act ln-act-${a.engine}${p.interactive ? '' : ' ln-watch'}`}>
      {a.directions && <p className="ln-directions"><Say text={a.directions} label="Read the directions" /> {a.directions}</p>}
      <Body {...p} />
    </div>
  );
}

function Body(p: ViewProps) {
  switch (p.a.engine) {
    case 'goal': return <Goal {...p} />;
    case 'slide': return <Slide {...p} />;
    case 'symbolMatch': return <SymbolMatch {...p} />;
    case 'sort': return <Sort {...p} />;
    case 'define': return <Define {...p} />;
    case 'wordList': return <WordList {...p} />;
    case 'memory': return <Memory {...p} />;
    case 'pull': return <Pull {...p} />;
    case 'build': return <Build {...p} />;
    case 'write': return <Write {...p} />;
    case 'fill': return <Fill {...p} />;
    case 'pyramid': return <Pyramid {...p} />;
    case 'edit': return <Edit {...p} />;
    case 'time': return <Time {...p} />;
    case 'choice': return <Choice {...p} />;
    case 'markup': return <Markup {...p} />;
    case 'tictactoe': return <TicTacToe {...p} />;
    case 'fishing': return <Fishing {...p} />;
    case 'search': return <Search {...p} />;
    case 'procA': return <ProcA {...p} />;
    case 'assess': return <Assess {...p} />;
    case 'board': return <Board {...p} />;
    case 'legacy': return <Legacy {...p} />;
  }
}

function Goal({ a, lesson }: ViewProps) {
  const d = a.data;
  const plan = (lesson?.tabs ?? []).filter((t) => t.kind !== 'goal');
  return (
    <div className="ln-goal">
      <p className="ln-goal-label">Today's goal <Say text={str(d.goal)} label="Read the goal" /></p>
      <p className="ln-goal-text">{str(d.goal)}</p>
      {str(d.closing) && <p className="ln-goal-closing">{str(d.closing)}</p>}
      {d.agenda !== false && plan.length > 0 && <ol className="ln-plan" aria-label="Today's plan">{plan.map((t) => <li key={t.id}>{t.title}</li>)}</ol>}
    </div>
  );
}

function Slide({ a }: ViewProps) {
  const d = a.data;
  return (
    <div className="ln-slide">
      {str(d.heading) && <h2 className="ln-slide-h">{str(d.heading)} <Say text={`${str(d.heading)}. ${str(d.text)}`} /></h2>}
      {str(d.picture) && <img className="ln-picture" src={str(d.picture)} alt="" />}
      {str(d.text) && <p className="ln-slide-text">{str(d.text)}</p>}
      {strs(d.bullets).length > 0 && <ul className="ln-bullets">{strs(d.bullets).map((b, i) => <li key={i}>{b}</li>)}</ul>}
    </div>
  );
}

// Tap a card, then tap where it goes (works the same with a finger, a mouse or a keyboard).
function SymbolMatch({ a, resp, set, interactive, quiet, teacher }: ViewProps) {
  const s = syms(a.data.symbols);
  const [held, setHeld] = useState<SymbolWordClass | null>(null);
  const placed = new Set(Object.values(resp) as string[]);
  const pool = shuffle(s, a.id).filter((c) => !placed.has(c));
  return (
    <div className="ln-match">
      <div className="ln-pool" aria-label="Symbols">
        {pool.map((c) => <button key={c} type="button" disabled={!interactive} className={`ln-card ln-sym-card${held === c ? ' held' : ''}`} onClick={() => setHeld(held === c ? null : c)} aria-label={`Symbol: ${symbolName(c)}`}><Sym c={c} size={72} /></button>)}
        {!pool.length && <p className="ln-done">All matched.</p>}
      </div>
      <div className="ln-targets">
        {s.map((c) => {
          const got = resp[c] as SymbolWordClass | undefined;
          return (
            <button key={c} type="button" disabled={!interactive} className={`ln-target${got ? (quiet && !teacher ? ' picked' : got === c ? ' right' : ' wrong') : ''}`}
              onClick={() => { if (held) { set({ ...Object.fromEntries(Object.entries(resp).filter(([, v]) => v !== held)), [c]: held }); setHeld(null); } else if (got) { const n = { ...resp }; delete n[c]; set(n); } }}>
              <span className="ln-target-name">{symbolName(c)}</span>
              <span className="ln-target-slot">{got ? <Sym c={got} size={60} /> : <span className="ln-empty">Tap a symbol, then tap here</span>}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Sort({ a, resp, set, interactive, quiet, teacher }: ViewProps) {
  const { cats, items } = useMemo(() => sortSetup(a.data), [a.data]);
  const [held, setHeld] = useState<number | null>(null);
  const order = useMemo(() => shuffle(items.map((_, i) => i), a.id), [items, a.id]);
  const loose = order.filter((i) => resp[i] == null);
  const put = (cat: string) => { if (held == null) return; set({ ...resp, [held]: cat }); setHeld(null); };
  return (
    <div className="ln-sort">
      <div className="ln-pool" aria-label="Cards to sort">
        {loose.map((i) => <button key={i} type="button" disabled={!interactive} className={`ln-card${held === i ? ' held' : ''}`} onClick={() => setHeld(held === i ? null : i)}>{items[i].text}</button>)}
        {!loose.length && <p className="ln-done">All sorted.</p>}
      </div>
      <div className="ln-cols" style={{ gridTemplateColumns: `repeat(${Math.min(cats.length, 4) || 1}, minmax(0, 1fr))` }}>
        {cats.map((c) => (
          <div key={c.id} className="ln-col">
            <button type="button" className="ln-col-head" disabled={!interactive} onClick={() => put(c.id)} aria-label={`Put it under ${c.label}`}>
              {c.cls ? <Sym c={c.cls} size={52} label /> : c.code ? <Strip code={c.code} /> : <strong>{c.label}</strong>}
            </button>
            <div className="ln-col-cards" onClick={() => put(c.id)}>
              {items.map((it, i) => (resp[i] === c.id ? (
                <button key={i} type="button" disabled={!interactive} className={`ln-card small ${it.ok.length && (!quiet || teacher) ? (it.ok.includes(c.id) ? 'right' : 'wrong') : ''}`} onClick={(e) => { e.stopPropagation(); const n = { ...resp }; delete n[i]; set(n); }}>{it.text}</button>
              ) : null))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Define({ a, resp, set, interactive }: ViewProps) {
  const models = new Map(strs(a.data.models).map(splitEq).map(([k, v]) => [symbolByName(k) ?? k, v]));
  const [shown, setShown] = useState(false);
  return (
    <div className="ln-define">
      {syms(a.data.symbols).map((c) => (
        <div key={c} className="ln-row">
          <Sym c={c} size={64} label />
          <textarea {...NOAUTO} className="ln-input" rows={2} readOnly={!interactive} value={str(resp[c])} placeholder="It means..." aria-label={`What does ${symbolName(c)} mean?`} onChange={(e) => set({ ...resp, [c]: e.target.value })} />
          {shown && <p className="ln-model">{models.get(c) || GRAMMAR_SYMBOL_INFO[c]?.label}</p>}
        </div>
      ))}
      <button type="button" className="btn" onClick={() => setShown((x) => !x)}>{shown ? 'Hide the meanings' : 'Show the meanings'}</button>
    </div>
  );
}

function WordList(p: ViewProps) {
  const { a, resp, set, interactive } = p;
  const seen = useSeen(p);
  const n = Math.max(1, Math.min(8, num(a.data.count, 3)));
  return (
    <div className="ln-wordlist">
      {syms(a.data.symbols).map((c) => {
        const list = strs(resp[c]);
        return (
          <div key={c} className="ln-row">
            <Sym c={c} size={60} label />
            <div className="ln-words">
              {Array.from({ length: n }, (_, i) => {
                const w = list[i] ?? '';
                const fit = w.trim() && seen.show(`${c}${i}`) ? wordFits(w, c) : null;
                return (
                  <label key={i} className="ln-word">
                    <input {...NOAUTO} {...seen.done(`${c}${i}`)} className="ln-input" readOnly={!interactive} value={w} aria-label={`${symbolName(c)} word ${i + 1}`}
                      onChange={(e) => { const next = [...list]; next[i] = e.target.value; set({ ...resp, [c]: next }); }} />
                    {fit && <Mark ok={fit === 'yes' ? true : fit === 'no' ? false : undefined} />}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Memory({ a, resp, set, interactive }: ViewProps) {
  const pairs = strs(a.data.pairs).map(splitEq).map(([k, w]) => ({ cls: symbolByName(k), word: w }));
  const cards = useMemo(() => shuffle(pairs.flatMap((_, i) => [{ pair: i, side: 's' as const }, { pair: i, side: 'w' as const }]), a.id), [a.id, pairs.length]);
  const found = new Set(strs(resp.found).map(Number));
  const up = (resp.up as number[] | undefined) ?? [];
  useEffect(() => {
    if (!interactive || up.length !== 2) return;
    const t = window.setTimeout(() => set({ ...resp, up: [] }), 1400);
    return () => window.clearTimeout(t);
  }, [up.join(','), interactive]);
  const flip = (k: number) => {
    if (up.includes(k) || found.has(cards[k].pair)) return;
    if (up.length >= 2) { set({ ...resp, up: [k] }); return; }
    const next = [...up, k];
    if (next.length === 2 && cards[next[0]].pair === cards[next[1]].pair) set({ ...resp, up: [], found: [...strs(resp.found), String(cards[k].pair)] });
    else set({ ...resp, up: next });
  };
  return (
    <div className="ln-memory" style={{ gridTemplateColumns: `repeat(${Math.min(4, Math.ceil(Math.sqrt(cards.length)))}, minmax(0, 1fr))` }}>
      {cards.map((c, k) => {
        const open = up.includes(k) || found.has(c.pair);
        const pr = pairs[c.pair];
        return (
          <button key={k} type="button" disabled={!interactive} className={`ln-mem${open ? ' open' : ''}${found.has(c.pair) ? ' found' : ''}`} onClick={() => flip(k)} aria-label={open ? (c.side === 's' ? symbolName(pr.cls!) : pr.word) : 'Card, face down'}>
            {open ? (c.side === 's' && pr.cls ? <Sym c={pr.cls} size={64} label /> : <span className="ln-mem-word">{pr.word}</span>) : <span className="ln-mem-back">?</span>}
          </button>
        );
      })}
      <p className="ln-score">{found.size} of {pairs.length} found</p>
    </div>
  );
}

function Pull(p: ViewProps) {
  const { a, resp, set, interactive } = p;
  const seen = useSeen(p);
  const deck = str(a.data.deck) === 'formulas' ? strs(a.data.formulas) : syms(a.data.symbols);
  const pulls = Math.max(1, num(a.data.pulls, 5));
  const pulled = strs(resp.pulled), answers = strs(resp.answers);
  const pull = () => { if (!deck.length) return; const r = seeded(`${a.id}-${pulled.length}`); set({ ...resp, pulled: [...pulled, deck[Math.floor(r() * deck.length)]] }); };
  const isF = str(a.data.deck) === 'formulas';
  return (
    <div className="ln-pull">
      {pulled.map((b, i) => {
        const ans = answers[i] ?? '';
        const ok = !ans.trim() || !seen.show(`p${i}`) ? undefined : isF ? !!checkWritten(ans, [b])?.ok : wordFits(ans, b as SymbolWordClass) !== 'no';
        return (
          <div key={i} className="ln-row ln-block">
            <span className="ln-jenga">{isF ? <Strip code={b} /> : <Sym c={b as SymbolWordClass} size={56} label />}</span>
            <input {...NOAUTO} {...seen.done(`p${i}`)} className="ln-input" readOnly={!interactive} value={ans} placeholder={isF ? 'Write a sentence' : 'Name a word'} aria-label="Your answer"
              onChange={(e) => { const n = [...answers]; n[i] = e.target.value; set({ ...resp, answers: n }); }} />
            <Mark ok={ok} />
          </div>
        );
      })}
      {pulled.length < pulls ? <button type="button" className="btn btn-primary ln-big" disabled={!interactive} onClick={pull}>Pull a block</button> : <p className="ln-done">All blocks pulled.</p>}
    </div>
  );
}

function Build({ a, resp, set, interactive, quiet, teacher }: ViewProps) {
  const items = strs(a.data.items).filter(Boolean);
  if (str(a.data.unit) === 'sentences') {
    const order = strs(resp.order);
    const left = shuffle(items, a.id).filter((s) => !order.includes(s));
    const ok = order.length === items.length && (!quiet || teacher) ? order.every((s, i) => s === items[i]) : undefined;
    return (
      <div className="ln-build">
        <ol className="ln-answer-list">{order.map((s, i) => <li key={i}><button type="button" disabled={!interactive} className="ln-card" onClick={() => set({ ...resp, order: order.filter((x) => x !== s) })}>{s}</button></li>)}</ol>
        <div className="ln-pool">{left.map((s) => <button key={s} type="button" disabled={!interactive} className="ln-card" onClick={() => set({ ...resp, order: [...order, s] })}>{s}</button>)}</div>
        {ok != null && <p className={`ln-result ${ok ? 'yes' : 'no'}`}>{ok ? 'That order makes sense.' : 'Read it back. Does each sentence follow the last one?'}</p>}
      </div>
    );
  }
  const model = str(a.data.model);
  return (
    <div className="ln-build">
      {model && <p className="ln-model-line">Model: <strong>{model}</strong> <Say text={model} /></p>}
      {items.map((s, i) => {
        const target = wordsOf(s);
        const mine = strs(resp[i]);
        const tiles = shuffle(target.map((w, k) => `${k}:${w}`), `${a.id}-${i}`).filter((t) => !mine.includes(t));
        const code = codeOf(model || s);
        const done = mine.length === target.length;
        const ok = done && (!quiet || teacher) ? mine.map((t) => t.slice(t.indexOf(':') + 1)).join(' ') === target.join(' ') : undefined;
        return (
          <div key={i} className="ln-build-item">
            {a.data.showStrip !== false && code && <Strip code={code} />}
            <div className={`ln-answer${ok === true ? ' right' : ok === false ? ' wrong' : ''}`} aria-label="Your sentence">
              {mine.length ? mine.map((t) => <button key={t} type="button" disabled={!interactive} className="ln-card" onClick={() => set({ ...resp, [i]: mine.filter((x) => x !== t) })}>{t.slice(t.indexOf(':') + 1)}</button>) : <span className="ln-empty">Tap the words in order</span>}
              {done && <Say text={mine.map((t) => t.slice(t.indexOf(':') + 1)).join(' ')} label="Read my sentence" />}
            </div>
            <div className="ln-pool">{tiles.map((t) => <button key={t} type="button" disabled={!interactive} className="ln-card" onClick={() => set({ ...resp, [i]: [...mine, t] })}>{t.slice(t.indexOf(':') + 1)}</button>)}</div>
          </div>
        );
      })}
    </div>
  );
}

function Write(p: ViewProps) {
  const { a, resp, set, interactive, teacher } = p;
  const seen = useSeen(p);
  const d = a.data;
  const n = Math.max(1, Math.min(10, num(d.lines, 1)));
  const lines = strs(resp.lines);
  const want = strs(d.formulas);
  const mode = (str(d.check) || 'formula') as 'formula' | 'sentence' | 'none';
  const [showModel, setShowModel] = useState(false);
  const dictate = strs(d.dictate);
  return (
    <div className="ln-write">
      {str(d.prompt) && <p className="ln-prompt">{str(d.prompt)} <Say text={str(d.prompt)} /></p>}
      {str(d.emoji) && <p className="ln-emoji" aria-label="Emojis">{str(d.emoji)}</p>}
      {str(d.picture) && <img className="ln-picture" src={str(d.picture)} alt="" />}
      {want.length > 0 && <div className="ln-strips">{want.map((c) => <Strip key={c} code={c} />)}</div>}
      {Array.from({ length: n }, (_, i) => {
        const res = checkWritten(lines[i] ?? '', want, mode);
        return (
          <div key={i} className="ln-line">
            {dictate[i] && <Say text={dictate[i]} label={`Listen to sentence ${i + 1}`} />}
            <input {...NOAUTO} {...seen.done(`w${i}`)} className="ln-input ln-sentence" readOnly={!interactive} value={lines[i] ?? ''} placeholder="Write your sentence" aria-label={`Sentence ${i + 1}`}
              onChange={(e) => { const next = [...lines]; next[i] = e.target.value; set({ ...resp, lines: next }); }} />
            {seen.show(`w${i}`) ? <CheckLine r={res} /> : mode !== 'none' && <span className="ln-hint">Capital letter at the start. Punctuation at the end.</span>}
          </div>
        );
      })}
      {str(d.model) && (teacher || lines.some(Boolean)) && <button type="button" className="btn" onClick={() => setShowModel((x) => !x)}>{showModel ? 'Hide the model' : 'Show the model'}</button>}
      {showModel && <p className="ln-model">{str(d.model)}</p>}
    </div>
  );
}

const BLANK = /\[([a-z ]+)\]/gi;
function blanksIn(text: string) { const out: SymbolWordClass[] = []; text.replace(BLANK, (_, k: string) => { out.push(symbolByName(k) ?? 'noun'); return ''; }); return out; }
function BlankText({ text, values, onChange, interactive, prefix, seen }: { text: string; values: Resp; onChange: (k: string, v: string) => void; interactive: boolean; prefix: string; seen: ReturnType<typeof useSeen> }) {
  const parts = text.split(BLANK);
  let k = -1;
  return (
    <span className="ln-blanks">
      {parts.map((part, i) => {
        if (i % 2 === 0) return <span key={i}>{part}</span>;
        k++;
        const cls = symbolByName(part) ?? 'noun';
        const key = `${prefix}${k}`;
        const v = str(values[key]);
        const fit = v.trim() && seen.show(key) ? wordFits(v, cls) : null;
        return (
          <span key={i} className="ln-blank">
            <Sym c={cls} size={30} />
            <input {...NOAUTO} {...seen.done(key)} className="ln-input ln-blank-in" readOnly={!interactive} value={v} aria-label={`A word for ${symbolName(cls)}`} onChange={(e) => onChange(key, e.target.value)} />
            {fit && <Mark ok={fit === 'yes' ? true : fit === 'no' ? false : undefined} />}
          </span>
        );
      })}
    </span>
  );
}
const fillText = (text: string, values: Resp, prefix: string) => { let k = -1; return text.replace(BLANK, (m) => { k++; return str(values[`${prefix}${k}`]) || m; }); };

function Fill(p: ViewProps) {
  const { a, resp, set, interactive } = p;
  const seen = useSeen(p);
  const story = str(a.data.story);
  const done = blanksIn(story).every((_, k) => str(resp[`b${k}`]).trim());
  return (
    <div className="ln-fill">
      <p className="ln-story"><BlankText seen={seen} text={story} values={resp} prefix="b" interactive={interactive} onChange={(k, v) => { const n = { ...resp, [k]: v }; set({ ...n, story: fillText(story, n, 'b') }); }} /></p>
      {done && <p className="ln-story-done">{fillText(story, resp, 'b')} <Say text={fillText(story, resp, 'b')} label="Read my silly story" /></p>}
    </div>
  );
}

function Pyramid(p: ViewProps) {
  const { a, resp, set, interactive, teacher } = p;
  const seen = useSeen(p);
  const given = strs(a.data.lines).filter(Boolean);
  const reveal = a.data.reveal !== false && !a.data.studentWrites;
  const shown = reveal ? Math.max(1, num(resp.shown, 1)) : given.length;
  const mine = strs(resp.lines);
  const extra = a.data.studentWrites ? Math.max(3, mine.length + (mine[mine.length - 1]?.trim() ? 1 : 0)) : 0;
  const rows = [...given.slice(0, shown).map((l, i) => ({ kind: 'given' as const, l, i })), ...Array.from({ length: extra }, (_, i) => ({ kind: 'mine' as const, l: mine[i] ?? '', i }))];
  const total = rows.length;
  return (
    <div className="ln-pyramid">
      {rows.map((r, k) => (
        <div key={`${r.kind}${r.i}`} className="ln-pyr-row" style={{ width: `${Math.min(100, 40 + (60 * (k + 1)) / Math.max(total, 1))}%` }}>
          {r.kind === 'given'
            ? <span className="ln-pyr-text"><BlankText seen={seen} text={r.l} values={resp} prefix={`p${r.i}_`} interactive={interactive} onChange={(key, v) => set({ ...resp, [key]: v })} /> <Say text={fillText(r.l, resp, `p${r.i}_`)} /></span>
            : <input {...NOAUTO} className="ln-input ln-sentence" readOnly={!interactive} value={r.l} placeholder={k === 0 ? 'Start your sentence' : 'Add one more part'} aria-label={`Line ${k + 1}`}
                onChange={(e) => { const n = [...mine]; n[r.i] = e.target.value; set({ ...resp, lines: n }); }} />}
        </div>
      ))}
      {reveal && (teacher || interactive) && shown < given.length && <button type="button" className="btn btn-primary ln-big" onClick={() => set({ ...resp, shown: shown + 1 })}>Next line</button>}
    </div>
  );
}

function Edit(p: ViewProps) {
  const { a, resp, set, interactive } = p;
  const seen = useSeen(p);
  return (
    <div className="ln-edit">
      {strs(a.data.items).map(splitArrow).map(([wrong, right], i) => {
        const v = resp[i] == null ? wrong : str(resp[i]);
        const ok = resp[i] == null || !seen.show(`e${i}`) ? undefined : right ? v.trim() === right.trim() : checkWritten(v, [], 'sentence')?.ok;
        return (
          <div key={i} className="ln-line">
            <p className="ln-wrong">{wrong} <Say text={wrong} /></p>
            <input {...NOAUTO} {...seen.done(`e${i}`)} className="ln-input ln-sentence" readOnly={!interactive} value={v} aria-label={`Fix sentence ${i + 1}`} onChange={(e) => set({ ...resp, [i]: e.target.value })} />
            <Mark ok={ok} />
          </div>
        );
      })}
    </div>
  );
}

function Time(p: ViewProps) {
  const { a, resp, set, interactive } = p;
  const seen = useSeen(p);
  return (
    <div className="ln-time">
      {strs(a.data.sentences).filter(Boolean).map((s, i) => {
        const key = tensesOf(s);
        const mine = (resp[i] ?? {}) as Resp;
        return (
          <div key={i} className="ln-time-item">
            <p className="ln-prompt">{s} <Say text={s} /></p>
            {(['past', 'present', 'future'] as const).map((t) => {
              const v = str(mine[t]);
              const ok = !v.trim() || !key || !seen.show(`t${i}${t}`) ? undefined : v.trim().replace(/[.!?]$/, '').toLowerCase() === key[t].trim().replace(/[.!?]$/, '').toLowerCase();
              return (
                <label key={t} className="ln-row ln-tense">
                  <span className="ln-sym"><img src={TENSE_SYMBOLS[t].imageUrl} alt="" width={44} height={44} /><span>{TENSE_SYMBOLS[t].name}</span></span>
                  <input {...NOAUTO} {...seen.done(`t${i}${t}`)} className="ln-input ln-sentence" readOnly={!interactive} value={v} aria-label={`${TENSE_SYMBOLS[t].name}`} onChange={(e) => set({ ...resp, [i]: { ...mine, [t]: e.target.value } })} />
                  <Mark ok={ok} />
                </label>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function Choice({ a, resp, set, interactive, quiet, teacher }: ViewProps) {
  return (
    <div className="ln-choice">
      {strs(a.data.items).map(splitBar).map(([q, opts = '', answer = ''], i) => {
        const options = opts.split('/').map((x) => x.trim()).filter(Boolean);
        const mine = str(resp[i]);
        return (
          <div key={i} className="ln-choice-item">
            <p className="ln-prompt">{q} {a.data.speak !== false && <Say text={q} />}</p>
            <div className="ln-options">
              {options.map((o) => (
                <button key={o} type="button" disabled={!interactive || (quiet && !teacher && !!mine)} className={`ln-option${mine === o ? (answer && (!quiet || teacher) ? (o === answer ? ' right' : ' wrong') : ' picked') : ''}`} onClick={() => set({ ...resp, [i]: o })}>{o}</button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Markup({ a, resp, set, interactive, quiet }: ViewProps) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="ln-markup">
      {strs(a.data.sentences).filter(Boolean).map((s, i) => {
        const key = symbolsOfSentence(s);
        const mine = (resp[i] ?? {}) as Resp;
        return (
          <div key={i} className="ln-markup-line">
            {key.map((w, j) => {
              const got = mine[j] as SymbolWordClass | undefined;
              const id = `${i}-${j}`;
              return (
                <span key={j} className="ln-mk">
                  <button type="button" disabled={!interactive} className={`ln-mk-word${got && !quiet ? (got === w.cls || wordFits(w.word, got) === 'yes' ? ' right' : ' wrong') : got ? ' picked' : ''}`} onClick={() => setOpen(open === id ? null : id)}>{w.word}</button>
                  <span className="ln-mk-sym">{got ? <Sym c={got} size={36} /> : <span className="ln-empty">?</span>}</span>
                  {open === id && (
                    <span className="ln-palette" role="menu">
                      {SYMBOL_ORDER.map((c) => <button key={c} type="button" role="menuitem" onClick={() => { set({ ...resp, [i]: { ...mine, [j]: c } }); setOpen(null); }}><Sym c={c} size={34} label /></button>)}
                    </span>
                  )}
                </span>
              );
            })}
            <Say text={s} />
          </div>
        );
      })}
    </div>
  );
}

const LINES3 = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
function TicTacToe({ a, resp, set, interactive }: ViewProps) {
  const codes = strs(a.data.formulas).length ? strs(a.data.formulas) : ['S1.A'];
  const squares = (resp.squares ?? {}) as Resp;
  const drafts = (resp.drafts ?? {}) as Resp;
  const [open, setOpen] = useState<number | null>(null);
  const won = LINES3.some((l) => l.every((k) => squares[k]));
  return (
    <div className="ln-ttt">
      <div className="ln-ttt-grid">
        {Array.from({ length: 9 }, (_, k) => {
          const code = codes[k % codes.length];
          return (
            <button key={k} type="button" disabled={!interactive && !squares[k]} className={`ln-ttt-sq${squares[k] ? ' claimed' : ''}${open === k ? ' held' : ''}`} onClick={() => setOpen(open === k ? null : k)}>
              {squares[k] ? <span className="ln-ttt-x">✓<small>{str(squares[k])}</small></span> : <Strip code={code} />}
            </button>
          );
        })}
      </div>
      {open != null && !squares[open] && (
        <div className="ln-line">
          <input {...NOAUTO} className="ln-input ln-sentence" readOnly={!interactive} autoFocus value={str(drafts[open])} placeholder={`A sentence for ${codes[open % codes.length]}`} aria-label="Your sentence"
            onChange={(e) => set({ ...resp, drafts: { ...drafts, [open]: e.target.value } })} />
          <CheckLine r={checkWritten(str(drafts[open]), [codes[open % codes.length]])} />
          <button type="button" className="btn btn-primary" disabled={!interactive || !(() => { const r = checkWritten(str(drafts[open]), [codes[open % codes.length]]); return r?.capital && r.punctuation; })()}
            onClick={() => { set({ ...resp, squares: { ...squares, [open]: str(drafts[open]) } }); setOpen(null); }}>Claim the square</button>
        </div>
      )}
      {won && <p className="ln-result yes">Three in a row!</p>}
    </div>
  );
}

const BANK: Partial<Record<SymbolWordClass, string[]>> = {
  article: ['the', 'a', 'an'], noun: ['dog', 'cat', 'frog', 'pizza', 'robot', 'tree'], propernoun: ['Max', 'Rosa', 'Tom'], pronoun: ['he', 'she', 'they', 'it'],
  verb: ['jumps', 'runs', 'sings', 'naps', 'eats', 'dances'], adjective: ['big', 'silly', 'green', 'tiny'], adverb: ['fast', 'slowly', 'loudly'],
  preposition: ['on', 'under', 'by'], conjunction: ['and', 'but'],
};
function bankFor(c: SymbolWordClass): string[] { try { const l = wordsOfType(c); if (l.length > 20) return l.slice(0, 400); } catch { /* lists still loading */ } return BANK[c] ?? ['word']; }
function Fishing({ a, resp, set, interactive }: ViewProps) {
  const codes = strs(a.data.formulas).length ? strs(a.data.formulas) : ['S1.A'];
  const done = strs(resp.done);
  const goal = Math.max(1, num(a.data.goal, 3));
  const code = codes[done.length % codes.length];
  const slots = formulaSlots(code).map((s) => symbolByName(s) ?? (s === 'propernoun' ? 'propernoun' : 'noun'));
  const hand = useMemo(() => {
    const r = seeded(`${a.id}-${done.length}`);
    const pick = (c: SymbolWordClass) => { const b = bankFor(c); return b[Math.floor(r() * b.length)]; };
    const cards = slots.map((c) => ({ c, w: pick(c) }));
    const extra = SYMBOL_ORDER.slice(0, 7);
    while (cards.length < Math.max(5, slots.length + 2)) { const c = extra[Math.floor(r() * extra.length)]; cards.push({ c, w: pick(c) }); }
    return shuffle(cards.map((x, i) => ({ ...x, id: `${i}` })), `${a.id}-h${done.length}`);
  }, [a.id, done.length, code]);
  const placed = strs(resp.placed);
  const next = slots[placed.length];
  const [why, setWhy] = useState('');
  const full = placed.length === slots.length && slots.length > 0;
  const sentence = (() => { const s = placed.map((id) => hand.find((h) => h.id === id)?.w ?? '').join(' '); return s ? `${s[0].toUpperCase()}${s.slice(1)}.` : ''; })();
  if (done.length >= goal) return <div className="ln-fishing"><p className="ln-result yes">You finished {goal} formulas!</p><ul className="ln-bullets">{done.map((s, i) => <li key={i}>{s}</li>)}</ul></div>;
  return (
    <div className="ln-fishing">
      <div className="ln-fish-card"><Strip code={code} /></div>
      <div className="ln-answer">{placed.length ? placed.map((id) => <span key={id} className="ln-card">{hand.find((h) => h.id === id)?.w}</span>) : <span className="ln-empty">Play a card for the first symbol</span>}</div>
      <div className="ln-pool">
        {hand.filter((h) => !placed.includes(h.id)).map((h) => (
          <button key={h.id} type="button" disabled={!interactive || full} className="ln-card ln-fish" onClick={() => { if (h.c === next || wordFits(h.w, next) !== 'no') { setWhy(''); set({ ...resp, placed: [...placed, h.id] }); } else setWhy(`"${h.w}" is ${symbolName(h.c).toLowerCase() === 'article' || symbolName(h.c).toLowerCase() === 'adjective' || symbolName(h.c).toLowerCase() === 'adverb' || symbolName(h.c).toLowerCase() === 'interjection' ? 'an' : 'a'} ${symbolName(h.c).toLowerCase()}. Look for ${['article', 'adjective', 'adverb', 'interjection'].includes(next) ? 'an' : 'a'} ${symbolName(next).toLowerCase()}.`); }}>
            <Sym c={h.c} size={26} /> {h.w}
          </button>
        ))}
      </div>
      {why && <p className="ln-hint" role="status">{why}</p>}
      {full && <p className="ln-story-done">{sentence} <Say text={sentence} label="Read my silly sentence" /> <button type="button" className="btn btn-primary" disabled={!interactive} onClick={() => set({ ...resp, done: [...done, sentence], placed: [] })}>I read it! Next formula</button></p>}
      {!full && interactive && <button type="button" className="btn" onClick={() => set({ ...resp, placed: placed.slice(0, -1) })} disabled={!placed.length}>Take back a card</button>}
      <p className="ln-score">{done.length} of {goal} formulas</p>
    </div>
  );
}

function makeGrid(words: string[], seed: string) {
  const W = words.map((w) => w.toUpperCase().replace(/[^A-Z]/g, '')).filter(Boolean);
  const size = Math.max(8, ...W.map((w) => w.length + 1));
  const g: string[][] = Array.from({ length: size }, () => Array(size).fill(''));
  const r = seeded(seed);
  const at: Record<string, number[]> = {};
  for (const w of W) {
    for (let tries = 0; tries < 200; tries++) {
      const down = r() < 0.5;
      const row = Math.floor(r() * (down ? size - w.length + 1 : size)), col = Math.floor(r() * (down ? size : size - w.length + 1));
      const cells = [...w].map((_, i) => (down ? (row + i) * size + col : row * size + col + i));
      if (cells.every((c, i) => !g[Math.floor(c / size)][c % size] || g[Math.floor(c / size)][c % size] === w[i])) { cells.forEach((c, i) => { g[Math.floor(c / size)][c % size] = w[i]; }); at[w] = cells; break; }
    }
  }
  const ABC = 'ABCDEFGHIJKLMNOPRSTUVWY';
  for (const row of g) for (let i = 0; i < size; i++) if (!row[i]) row[i] = ABC[Math.floor(r() * ABC.length)];
  return { g, size, at };
}
function Search(p: ViewProps) {
  const { a, resp, set, interactive } = p;
  const seen = useSeen(p);
  const all = strs(a.data.words).filter(Boolean);
  const { g, size, at } = useMemo(() => makeGrid(all, a.id), [all.join(','), a.id]);
  const words = all.filter((w) => at[w.toUpperCase().replace(/[^A-Z]/g, '')]); // a word that did not fit is left off the list
  const [miss, setMiss] = useState(false);
  const found = strs(resp.found);
  const [first, setFirst] = useState<number | null>(null);
  const lit = new Set(found.flatMap((w) => at[w.toUpperCase()] ?? []));
  const tap = (c: number) => {
    setMiss(false);
    if (first == null) { setFirst(c); return; }
    if (first === c) { setFirst(null); return; }
    const hit = Object.entries(at).find(([, cells]) => (cells[0] === first && cells[cells.length - 1] === c) || (cells[0] === c && cells[cells.length - 1] === first));
    if (!hit) { setMiss(true); return; } // keep the first letter lit and try another last letter
    if (!found.includes(hit[0].toLowerCase())) set({ ...resp, found: [...found, hit[0].toLowerCase()] });
    setFirst(null);
  };
  return (
    <div className="ln-search">
      <p className="ln-muted">Tap the first letter of a word, then its last letter.</p>
      <div className="ln-grid" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
        {g.flat().map((ch, c) => <button key={c} type="button" disabled={!interactive} className={`ln-cell${lit.has(c) ? ' lit' : ''}${first === c ? ' held' : ''}`} onClick={() => tap(c)}>{ch}</button>)}
      </div>
      {miss && <p className="ln-hint" role="status">Not a word yet. Tap another last letter, or tap the first letter again to start over.</p>}
      <ul className="ln-find">{words.map((w) => <li key={w} className={found.includes(w.toLowerCase()) ? 'yes' : ''}>{w}</li>)}</ul>
      {str(a.data.prompt) && <p className="ln-prompt">{str(a.data.prompt)}</p>}
      <input {...NOAUTO} {...seen.done('s')} className="ln-input ln-sentence" readOnly={!interactive} value={str(resp.sentence)} placeholder="Write your sentence" aria-label="Your sentence" onChange={(e) => set({ ...resp, sentence: e.target.value })} />
      {seen.show('s') && <CheckLine r={checkWritten(str(resp.sentence), [], 'sentence')} />}
    </div>
  );
}

const STEPS = ['The formula', 'I do', 'We do', 'You do', 'Sentence Check'];
function ProcA(p: ViewProps) {
  const { a, resp, set, interactive, teacher } = p;
  const seen = useSeen(p);
  const d = a.data;
  const code = str(d.formula);
  const row = formulaRow(code);
  const model = str(d.model) || row?.sentence || '';
  const step = Math.max(0, Math.min(STEPS.length - 1, num(resp.step, 0)));
  const lines = strs(resp.lines);
  return (
    <div className="ln-proca">
      <div className="ln-steps" role="tablist" aria-label="Procedure A">
        {STEPS.map((s, i) => <button key={s} type="button" role="tab" aria-selected={i === step} className={`ln-step${i === step ? ' on' : ''}`} disabled={!teacher && !interactive} onClick={() => set({ ...resp, step: i })}>{s}</button>)}
      </div>
      {step === 0 && (
        <div className="ln-slide">
          <h2 className="ln-slide-h">{row?.name ?? code}</h2>
          <Strip code={code} />
          {row?.purpose && <p className="ln-slide-text">{row.purpose} <Say text={`${row.name}. ${row.purpose}`} /></p>}
        </div>
      )}
      {step === 1 && (
        <div className="ln-slide">
          <p className="ln-big-sentence">{model} <Say text={model} /></p>
          <div className="ln-under">{symbolsOfSentence(model).map((w, i) => <span key={i} className="ln-under-w"><Sym c={w.cls} size={40} /><span>{w.word}</span></span>)}</div>
          {strs(d.iDo).length > 0 && <ul className="ln-bullets">{strs(d.iDo).map((x, i) => <li key={i}>{x}</li>)}</ul>}
          {str(d.nonExample) && <p className="ln-nonexample">Not this: <s>{str(d.nonExample)}</s></p>}
        </div>
      )}
      {step === 2 && <div className="ln-slide">{strs(d.weDo).length ? strs(d.weDo).map((s, i) => <p key={i} className="ln-big-sentence">{s} <Say text={s} /></p>) : <p className="ln-slide-text">Build a sentence together with the formula.</p>}</div>}
      {step === 3 && (
        <div className="ln-write">
          <Strip code={code} />
          {(strs(d.youDo).length ? strs(d.youDo) : ['Write a sentence for the formula.']).map((q, i) => (
            <div key={i} className="ln-line">
              <p className="ln-prompt">{q} <Say text={q} /></p>
              <input {...NOAUTO} {...seen.done(`y${i}`)} className="ln-input ln-sentence" readOnly={!interactive} value={lines[i] ?? ''} aria-label={q} onChange={(e) => { const n = [...lines]; n[i] = e.target.value; set({ ...resp, lines: n }); }} />
              {seen.show(`y${i}`) && <CheckLine r={checkWritten(lines[i] ?? '', [code])} />}
            </div>
          ))}
        </div>
      )}
      {step === 4 && <ol className="ln-plan">{strs(d.checklist).map((c, i) => <li key={i}>{c}</li>)}</ol>}
      {(teacher || interactive) && (
        <div className="ln-row">
          <button type="button" className="btn" disabled={step === 0} onClick={() => set({ ...resp, step: step - 1 })}>Back</button>
          <button type="button" className="btn btn-primary" disabled={step === STEPS.length - 1} onClick={() => set({ ...resp, step: step + 1 })}>Next: {STEPS[step + 1] ?? ''}</button>
        </div>
      )}
    </div>
  );
}

// A quick check: no modeling and no marks for students (the teacher sees the scores in the live view and report).
function Assess({ a, resp, set, interactive, teacher }: ViewProps) {
  const lines = strs(resp.lines);
  return (
    <div className="ln-write">
      {strs(a.data.items).map(splitBar).map(([q, code = ''], i) => (
        <div key={i} className="ln-line">
          <p className="ln-prompt"><span className="ln-num">{i + 1}</span> {q} <Say text={q} /></p>
          {code && <Strip code={code} />}
          <input {...NOAUTO} className="ln-input ln-sentence" readOnly={!interactive} value={lines[i] ?? ''} aria-label={`Item ${i + 1}`} onChange={(e) => { const n = [...lines]; n[i] = e.target.value; set({ ...resp, lines: n }); }} />
          {teacher && <CheckLine r={checkWritten(lines[i] ?? '', code ? [code] : [], code ? 'formula' : 'sentence')} />}
        </div>
      ))}
    </div>
  );
}

function Board({ a, teacher }: ViewProps) {
  const embed = useMemo(() => ({ initial: a.board ?? { placed: [], strokes: [] }, onChange: () => {}, presenting: true }), [a.id, teacher ? 0 : JSON.stringify(a.board)]);
  return <div className="ln-board"><LiteracyManipulatives key={teacher ? a.id : `${a.id}-${JSON.stringify(a.board).length}`} embed={embed} /></div>;
}
function Legacy({ a }: ViewProps) {
  return <div className="dp-sheet ln-legacy"><TemplateView kind={str(a.data.kind) as PageKind} data={a.data.page as PageData} learn pageTitle={a.title} /></div>;
}

// ---------- Edit mode: every student-facing detail ----------
const FORMULA_OPTIONS = MASTER_FORMULAS.map((m) => ({ value: m.code, label: `${m.skill} ${m.code}: ${m.formula}` })).filter((o, i, all) => all.findIndex((x) => x.value === o.value) === i);

export function SymbolPicker({ value, onChange }: { value: SymbolWordClass[]; onChange: (v: SymbolWordClass[]) => void }) {
  return (
    <div className="ln-picker" role="group">
      {SYMBOL_ORDER.map((c) => {
        const on = value.includes(c);
        return <button key={c} type="button" aria-pressed={on} className={`ln-pick${on ? ' on' : ''}`} title={symbolName(c)} onClick={() => onChange(on ? value.filter((x) => x !== c) : [...value, c])}><Sym c={c} size={28} /><span>{symbolName(c)}</span></button>;
      })}
    </div>
  );
}
export function FormulaPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState('');
  const hits = q.trim() ? FORMULA_OPTIONS.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())).slice(0, 12) : [];
  return (
    <div className="ln-fpicker">
      <div className="ln-chips">{value.map((c) => <span key={c} className="ln-chip" title={formulaLabel(c)}>{c}<button type="button" aria-label={`Remove ${c}`} onClick={() => onChange(value.filter((x) => x !== c))}>×</button></span>)}</div>
      <input value={q} placeholder="Find a formula: S1.A, noun verb, 1.1.1..." onChange={(e) => setQ(e.target.value)} aria-label="Find a formula" />
      {hits.length > 0 && <ul className="ln-hits">{hits.map((o) => <li key={o.value}><button type="button" onClick={() => { if (!value.includes(o.value)) onChange([...value, o.value]); setQ(''); }}>{o.label}</button></li>)}</ul>}
    </div>
  );
}

async function shrinkPicture(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, 900 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.75);
  } finally { URL.revokeObjectURL(url); }
}

function FieldInput({ f, value, onChange }: { f: Field; value: unknown; onChange: (v: unknown) => void }) {
  switch (f.kind) {
    case 'text': return <input value={str(value)} onChange={(e) => onChange(e.target.value)} />;
    case 'textarea': return <textarea rows={3} value={str(value)} onChange={(e) => onChange(e.target.value)} />;
    case 'lines': return <textarea rows={Math.max(3, strs(value).length + 1)} value={strs(value).join('\n')} onChange={(e) => onChange(e.target.value.split('\n'))} />;
    case 'number': return <input type="number" min={1} max={20} value={num(value, 1)} onChange={(e) => onChange(Number(e.target.value) || 1)} />;
    case 'bool': return <input type="checkbox" checked={value !== false && value !== undefined} onChange={(e) => onChange(e.target.checked)} />;
    case 'select': return <select value={str(value)} onChange={(e) => onChange(e.target.value)}>{f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
    case 'symbols': return <SymbolPicker value={syms(value)} onChange={onChange} />;
    case 'formulas': return <FormulaPicker value={strs(value)} onChange={onChange} />;
    case 'formula': return <FormulaPicker value={str(value) ? [str(value)] : []} onChange={(v) => onChange(v[v.length - 1] ?? '')} />;
    case 'picture': return (
      <span className="ln-pic-field">
        {str(value) && <img src={str(value)} alt="" />}
        <input type="file" accept="image/*" onChange={async (e) => { const f0 = e.target.files?.[0]; if (f0) onChange(await shrinkPicture(f0)); }} aria-label="Choose a picture" />
        {str(value) && <button type="button" className="btn btn-sm" onClick={() => onChange('')}>Remove picture</button>}
      </span>
    );
  }
}

export function ActivityEditor({ a, onChange }: { a: Activity; onChange: (patch: Partial<Activity>) => void }) {
  const fields = ENGINE_FIELDS[a.engine];
  return (
    <div className="ln-editor">
      <label className="dp-field"><span>Card name</span><input value={a.title} onChange={(e) => onChange({ title: e.target.value })} /></label>
      <label className="dp-field"><span>Short description (on the card)</span><input value={a.about} onChange={(e) => onChange({ about: e.target.value })} /></label>
      <label className="dp-field"><span>Directions students read and hear</span><textarea rows={2} value={a.directions} onChange={(e) => onChange({ directions: e.target.value })} /></label>
      <div className="dp-field"><span>Students</span>
        <div className="dp-row" role="radiogroup">
          <button type="button" role="radio" aria-checked={a.access === 'view'} className={`btn btn-sm${a.access === 'view' ? ' btn-primary' : ''}`} onClick={() => onChange({ access: 'view' })}>View only</button>
          <button type="button" role="radio" aria-checked={a.access === 'do'} className={`btn btn-sm${a.access === 'do' ? ' btn-primary' : ''}`} onClick={() => onChange({ access: 'do' })}>Students do it</button>
        </div>
      </div>
      <label className="dp-field"><span>Time</span><input value={a.minutes ?? ''} placeholder="3 min" onChange={(e) => onChange({ minutes: e.target.value })} /></label>
      <label className="dp-field"><span>Practice type</span>
        <select value={a.scope ?? ''} onChange={(e) => onChange({ scope: (e.target.value || undefined) as Activity['scope'] })}>
          <option value="">Not set</option><option value="lesson">Lesson-specific (today's formula only)</option><option value="cumulative">Cumulative review (mixed with earlier formulas)</option>
        </select>
      </label>
      {fields.map((f) => (
        <label key={f.key} className={`dp-field${f.kind === 'bool' ? ' dp-check' : ''}`}>
          <span>{f.label}</span>
          <FieldInput f={f} value={a.data[f.key]} onChange={(v) => onChange({ data: { ...a.data, [f.key]: v } })} />
          {f.help && <small className="dp-muted">{f.help}</small>}
        </label>
      ))}
      {a.engine === 'board' && <p className="dp-muted">Build this page on the whiteboard in the middle. Its materials are on the board's right side.</p>}
      {a.engine === 'legacy' && <TemplateEditor kind={str(a.data.kind) as PageKind} data={a.data.page as PageData} onChange={(page) => onChange({ data: { ...a.data, page } })} />}
      <label className="dp-field"><span>Teacher notes <span className="dp-muted">(only you see these)</span></span><textarea rows={6} value={a.notes} onChange={(e) => onChange({ notes: e.target.value })} /></label>
    </div>
  );
}
