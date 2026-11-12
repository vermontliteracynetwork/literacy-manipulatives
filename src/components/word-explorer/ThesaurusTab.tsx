import { useContext, useMemo, useState } from 'react';
import { FormulaSymbols } from '../SentenceFormulas';
import { PosSymbol, SpeakButton, Spoken, TapContext, TapWord, useReader } from './parts';
import { GRAMMAR_SYMBOL_INFO } from '../../lib/grammarSymbols';
import { frameFor, formOf, inForm, nearInfo, nearWords, oppositeType, OPPOSITE_NAMES, scaleFor, type Near, type OppositeType } from '../../lib/word-explorer/thesaurus';
import { formulaFor } from '../../lib/word-explorer/formula';
import { visibleTo, type PartOfSpeech, type Sense, type Tier, type WordEntry } from '../../lib/word-explorer/types';

// The Thesaurus tab (build spec 4.2, Phase 3): one cluster per meaning with a sentence-frame heading, opposites in
// three places (beside each meaning, the Opposites section, the roots of the word tree), word lines, the word tree
// with a List view, Tier filters, and swapping a word in a sentence while keeping its form.

const TIER_NAMES: Record<Tier, string> = { 1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3' };

export function ThesaurusTab({ entry, teacher }: { entry: WordEntry; teacher: boolean }) {
  const senses = entry.senses.filter((s) => visibleTo(s.definition.status, teacher));
  const [tiers, setTiers] = useState<Set<Tier>>(new Set());
  const [view, setView] = useState<'tree' | 'list'>('tree');
  const keep = (n: Near) => !tiers.size || tiers.has(n.tier);
  const toggle = (t: Tier) => setTiers((s) => { const n = new Set(s); if (n.has(t)) n.delete(t); else n.add(t); return n; });
  const opposites = useMemo(() => {
    const out: { word: string; type: OppositeType; sense: Sense }[] = [];
    for (const s of senses) for (const a of s.antonyms) if (!out.some((o) => o.word === a.wordId)) out.push({ word: a.wordId, type: oppositeType(entry.headword, a.wordId, s.pos), sense: s });
    return out;
  }, [senses, entry.headword]);

  if (!senses.length) return <p className="wx-waiting">This word's meanings are waiting for a teacher to check them.</p>;
  return (
    <div className="wx-tab-stack">
      <div className="wx-filter" role="group" aria-label="Show Tiers">
        <span className="wx-filter-label">Show:</span>
        {([1, 2, 3] as Tier[]).map((t) => (
          <button key={t} type="button" className={`wx-chip${tiers.has(t) ? ' armed' : ''}`} aria-pressed={tiers.has(t)} onClick={() => toggle(t)}>{TIER_NAMES[t]}</button>
        ))}
        {tiers.size > 0 && <button type="button" className="wx-chip" onClick={() => setTiers(new Set())}>All Tiers</button>}
      </div>

      {senses.map((s, i) => {
        const near = nearWords(s).filter(keep);
        const frame = frameFor(s.pos);
        const opp = s.antonyms.map((a) => a.wordId);
        return (
          <section key={s.id} className="wx-card wx-cluster" aria-labelledby={`cl-${i}`}>
            <h2 id={`cl-${i}`} className="wx-h2">{entry.headword} ({s.signpost})</h2>
            <p className="wx-frame"><FormulaSymbols slots={frame.slots} labels /><span className="wx-frame-text">{frame.text}</span></p>
            {near.length ? (
              <ul className="wx-near">
                {near.map((n, k) => (
                  <li key={n.word}><TapWord word={n.word} bold={k === 0} /><span className="wx-tier">{TIER_NAMES[n.tier]}</span></li>
                ))}
              </ul>
            ) : <p className="wx-muted">{tiers.size ? 'No words in the Tiers you picked.' : 'No other words for this meaning yet.'}</p>}
            {opp.length > 0 && (
              <p className="wx-cluster-opp"><span className="wx-why-label">Opposite:</span> {opp.map((w) => <TapWord key={w} word={w} />)}</p>
            )}
          </section>
        );
      })}

      <section className="wx-card" aria-labelledby="wx-opp-h">
        <h2 id="wx-opp-h" className="wx-h2">Opposites</h2>
        {opposites.length === 0 ? <p className="wx-muted">Word Explorer does not have an opposite for this word yet.</p> : (
          (['scale', 'either-or', 'direction', 'prefix'] as OppositeType[]).map((t) => {
            const list = opposites.filter((o) => o.type === t);
            if (!list.length) return null;
            return (
              <div key={t} className="wx-opp-group">
                <h3 className="wx-h3">{OPPOSITE_NAMES[t]}</h3>
                <div className="wx-chips">{list.map((o) => <TapWord key={o.word} word={o.word} />)}</div>
                {t === 'scale' && list.map((o) => { const line = scaleFor(entry.headword, o.word); return line ? <WordLine key={o.word} words={line} current={entry.headword} /> : null; })}
                {t === 'prefix' && <p className="wx-muted">See the Word Parts tab for how the prefix changes the meaning.</p>}
              </div>
            );
          })
        )}
        {opposites.length === 0 && scaleFor(entry.headword) && <WordLine words={scaleFor(entry.headword)!} current={entry.headword} />}
      </section>

      <section className="wx-card" aria-labelledby="wx-tree-h">
        <div className="wx-row-head">
          <h2 id="wx-tree-h" className="wx-h2">Word tree</h2>
          <div className="wx-seg" role="group" aria-label="Tree or list">
            <button type="button" className={`wx-chip${view === 'tree' ? ' armed' : ''}`} aria-pressed={view === 'tree'} onClick={() => setView('tree')}>Tree</button>
            <button type="button" className={`wx-chip${view === 'list' ? ' armed' : ''}`} aria-pressed={view === 'list'} onClick={() => setView('list')}>List view</button>
          </div>
        </div>
        {view === 'tree' ? <WordTree entry={entry} senses={senses} keep={keep} opposites={opposites.map((o) => o.word)} /> : <TreeList entry={entry} senses={senses} keep={keep} opposites={opposites.map((o) => o.word)} />}
      </section>

      <SwapWord entry={entry} senses={senses} />
    </div>
  );
}

function WordLine({ words, current }: { words: string[]; current: string }) {
  const { read } = useReader();
  return (
    <div className="wx-wordline" role="group" aria-label={`Word line: ${words.join(', ')}`}>
      <span className="wx-wordline-end">less</span>
      <ol>
        {words.map((w) => (
          <li key={w}><button type="button" data-nosay className={`wx-wordline-word${w === current ? ' on' : ''}`} onClick={() => read(`line:${w}`, w)}>{w}</button></li>
        ))}
      </ol>
      <span className="wx-wordline-end">more</span>
    </div>
  );
}

// ---------- the word tree ----------
// The word is on the trunk; meanings branch first; words for each meaning grow off it (closer to the branch means
// closer in meaning); a bigger leaf is a more common word; each leaf has its part of speech symbol and outline and
// its Tier. Opposites are the roots. Tapping a leaf says it; "Grow from here" starts a tree from that word.
function WordTree({ entry, senses, keep, opposites }: { entry: WordEntry; senses: Sense[]; keep: (n: Near) => boolean; opposites: string[] }) {
  const { read } = useReader();
  const { open } = useContext(TapContext);
  const [picked, setPicked] = useState<string | null>(null);
  const W = 1000, H = 760, cx = W / 2, trunkTop = 520, trunkBottom = 590;
  const shown = senses.slice(0, 5);
  const leaves: { word: string; x: number; y: number; r: number; pos: PartOfSpeech; tier: Tier; bx: number; by: number; w: number; h: number; fixed?: boolean }[] = [];
  const branches = shown.map((s, i) => {
    const angle = Math.PI * (1.08 + (0.84 * (i + 0.5)) / shown.length);
    const bx = cx + Math.cos(angle) * 230, by = trunkTop + Math.sin(angle) * 230;
    nearWords(s).filter(keep).slice(0, 5).forEach((n, k) => {
      const spread = (k - 2) * 0.3;
      const dist = 95 + (1 - n.closeness) * 80 + k * 18;
      const r = 52 - n.band * 5;
      const scale = Math.max(0.85, r / 40);
      leaves.push({ word: n.word, x: bx + Math.cos(angle + spread) * dist, y: by + Math.sin(angle + spread) * dist, r, pos: s.pos, tier: n.tier, bx, by, w: (n.word.length * 10 + 64) * scale, h: 48 });
    });
    return { s, bx, by };
  });
  // Spread the leaves so none cover each other, a branch name or the trunk.
  const blocks = [
    ...branches.map((b) => ({ x: b.bx, y: b.by, w: b.s.signpost.length * 8 + 30, h: 30, fixed: true })),
    { x: cx, y: (trunkTop + trunkBottom) / 2, w: entry.headword.length * 14 + 40, h: 50, fixed: true },
  ];
  for (let it = 0; it < 120; it++) {
    const all = [...leaves, ...blocks];
    for (const a of leaves) for (const o of all) {
      if (a === o) continue;
      const dx = a.x - o.x, dy = a.y - o.y;
      const ox = (a.w + o.w) / 2 + 6 - Math.abs(dx), oy = (a.h + o.h) / 2 + 4 - Math.abs(dy);
      if (ox > 0 && oy > 0) {
        if (ox < oy * 1.6) a.x += (dx >= 0 ? 1 : -1) * ox * ('fixed' in o && o.fixed ? 1 : 0.5);
        else a.y += (dy >= 0 ? 1 : -1) * oy * ('fixed' in o && o.fixed ? 1 : 0.5);
      }
    }
    for (const a of leaves) { a.x = Math.max(a.w / 2 + 4, Math.min(W - a.w / 2 - 4, a.x)); a.y = Math.max(28, Math.min(trunkBottom - 40, a.y)); }
  }
  const roots = opposites.slice(0, 5).map((w, i, list) => ({ word: w, x: cx + (i - (list.length - 1) / 2) * 160, y: H - 50, ...nearInfo(w) }));
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  return (
    <div>
      <div className="wx-tree" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="wx-tree-svg">
          <path d={`M${cx} ${trunkBottom} L${cx} ${trunkTop}`} className="wx-trunk" />
          {branches.map((b, i) => <path key={i} d={`M${cx} ${trunkTop} Q${cx} ${(trunkTop + b.by) / 2} ${b.bx} ${b.by}`} className="wx-branch" />)}
          {leaves.map((l, i) => <path key={i} d={`M${l.bx} ${l.by} L${clamp(l.x, 60, W - 60)} ${clamp(l.y, 40, H - 40)}`} className="wx-twig" />)}
          {roots.map((r) => <path key={r.word} d={`M${cx} ${trunkBottom} Q${cx} ${H - 80} ${r.x} ${r.y - 18}`} className="wx-root-line" />)}
        </svg>
        <span className="wx-tree-trunk" style={{ left: `${(cx / W) * 100}%`, top: `${(((trunkTop + trunkBottom) / 2) / H) * 100}%` }}>{entry.headword}</span>
        {branches.map((b) => (
          <span key={b.s.id} className="wx-tree-branch" style={{ left: `${(b.bx / W) * 100}%`, top: `${(b.by / H) * 100}%` }}>{b.s.signpost}</span>
        ))}
        {leaves.map((l) => {
          const info = GRAMMAR_SYMBOL_INFO[l.pos];
          return (
            <button key={`${l.word}-${l.bx}`} type="button" data-nosay className={`wx-leaf${picked === l.word ? ' on' : ''}`}
              style={{ left: `${(clamp(l.x, 60, W - 60) / W) * 100}%`, top: `${(clamp(l.y, 40, H - 40) / H) * 100}%`, borderColor: info.color, fontSize: `${Math.max(0.85, l.r / 40)}rem` }}
              aria-label={`${l.word}, ${l.pos}, Tier ${l.tier}`} onClick={() => { read(`leaf:${l.word}`, l.word); setPicked(l.word); }}>
              <PosSymbol pos={l.pos} size={18} decorative /><span>{l.word}</span><span className="wx-leaf-tier">T{l.tier}</span>
            </button>
          );
        })}
        {roots.map((r) => (
          <button key={r.word} type="button" data-nosay className={`wx-leaf wx-rootleaf${picked === r.word ? ' on' : ''}`} style={{ left: `${(r.x / W) * 100}%`, top: `${(r.y / H) * 100}%` }}
            aria-label={`${r.word}, opposite, Tier ${r.tier}`} onClick={() => { read(`root:${r.word}`, r.word); setPicked(r.word); }}>
            <span>{r.word}</span><span className="wx-leaf-tier">T{r.tier}</span>
          </button>
        ))}
      </div>
      <p className="wx-muted">Opposites are the roots. A bigger leaf is a more common word. Each leaf shows its part of speech symbol and Tier.</p>
      {picked && (
        <div className="wx-tree-picked" role="status">
          <strong>{picked}</strong>
          <button type="button" className="wx-btn wx-btn-primary" onClick={() => open(picked, 'thesaurus')}>Grow from here</button>
          <button type="button" className="wx-btn" onClick={() => open(picked)}>Open word page</button>
        </div>
      )}
    </div>
  );
}

function TreeList({ entry, senses, keep, opposites }: { entry: WordEntry; senses: Sense[]; keep: (n: Near) => boolean; opposites: string[] }) {
  return (
    <div className="wx-treelist">
      <p><strong>{entry.headword}</strong></p>
      <ul>
        {senses.map((s) => (
          <li key={s.id}>
            <span className="wx-treelist-meaning">{s.signpost}</span>
            <ul>{nearWords(s).filter(keep).map((n) => <li key={n.word}><TapWord word={n.word} pos={s.pos} /> <span className="wx-tier">{TIER_NAMES[n.tier]}</span></li>)}</ul>
          </li>
        ))}
        {opposites.length > 0 && <li><span className="wx-treelist-meaning">Opposites (roots)</span><ul>{opposites.map((w) => <li key={w}><TapWord word={w} /></li>)}</ul></li>}
      </ul>
    </div>
  );
}

// ---------- swap a word ----------
function SwapWord({ entry, senses }: { entry: WordEntry; senses: Sense[] }) {
  const first = senses.flatMap((s) => s.examples.map((e) => ({ e, s }))).find(({ e, s }) => /[.!?]$/.test(e.text) && e.text.split(/\s+/).some((w) => formOf(w.replace(/[^A-Za-z']/g, ''), entry.headword, s.pos)));
  const [sentence, setSentence] = useState(first?.e.text ?? '');
  const [swapped, setSwapped] = useState<string | null>(null);
  const words = sentence.split(/(\s+)/);
  const hit = (() => {
    for (const s of senses) for (let i = 0; i < words.length; i++) {
      const bare = words[i].replace(/[^A-Za-z']/g, '');
      const f = bare && formOf(bare, entry.headword, s.pos);
      if (f) return { i, f, s, bare };
    }
    return null;
  })();
  const options = hit ? nearWords(hit.s).filter((n) => !n.word.includes(' ')).sort((a, b) => b.closeness - a.closeness || a.band - b.band).slice(0, 12).map((n) => ({ ...n, form: inForm(n.word, hit.f, hit.s.pos) })) : [];
  const before = useMemo(() => formulaFor(sentence), [sentence]);
  const after = useMemo(() => (swapped ? formulaFor(swapped) : ''), [swapped]);
  const swap = (form: string) => {
    if (!hit) return;
    const copy = [...words];
    const orig = copy[hit.i];
    const cased = /^[A-Z]/.test(hit.bare) ? form[0].toUpperCase() + form.slice(1) : form;
    copy[hit.i] = orig.replace(hit.bare, cased);
    setSwapped(copy.join(''));
  };
  return (
    <section className="wx-card" aria-labelledby="wx-swap-h">
      <h2 id="wx-swap-h" className="wx-h2">Swap a word</h2>
      <p className="wx-muted">Pick a word to put in place of {entry.headword}. It keeps the same form, and the formula check runs again.</p>
      <label className="wx-swap-label" htmlFor="wx-swap">Sentence</label>
      <input id="wx-swap" className="wx-input" value={sentence} onChange={(e) => { setSentence(e.target.value); setSwapped(null); }} placeholder={`Type a sentence with ${entry.headword}`} />
      {!hit ? <p className="wx-muted">Type a sentence that uses {entry.headword}.</p> : (
        <>
          <div className="wx-chips wx-swap-options">
            {options.map((o) => <button key={o.word} type="button" className="wx-chip" onClick={() => swap(o.form)}>{o.form}</button>)}
            {!options.length && <span className="wx-muted">No other words for this meaning yet.</span>}
          </div>
          {swapped && (
            <div className="wx-swap-result">
              <p className="wx-example-line"><SpeakButton id="swap" text={swapped} label="Read the new sentence" /><Spoken id="swap" text={swapped} /></p>
              <p className="wx-muted">
                {before && after ? (before === after ? `Formula check: still ${after}.` : `Formula check: was ${before}, now ${after}.`)
                  : after ? `Formula check: ${after}.` : before ? `Formula check: ${before} before; the new sentence does not match a formula.` : 'Formula check: neither sentence matches one of the formulas yet.'}
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
