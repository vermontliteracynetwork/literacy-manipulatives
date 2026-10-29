import { useEffect, useMemo, useState } from 'react';
import { MONTESSORI_WORD_CLASS_INFO, TENSE_SYMBOLS, type MontessoriWordClass } from '../lib/montessoriGrammar';
import { SENTENCE_FORMULAS, type SentenceFormula } from '../lib/writer/formulas';
import { tagForCheck } from '../lib/writer/sentenceCheck';
import { cardSlotsOf, formulaCode, formulasLike, sentenceSlots, slotClass, slotLabel } from '../lib/writer/formulaMatch';
import { tenseVersions } from '../lib/writer/tenses';
import { removeFromBook, clearIdeas, type BookEntry, type FormulaIdea } from '../lib/writer/formulaBook';

// Sentence Formulas (her request 2026-10-28): her Formula Master List and formula cards (2026-10-28) as a
// reference students can search, sorted by unit in tabs. Each formula shows her formula card, opens to her
// sentence card and the model sentence in the past, present and future, and can be used to write: "Write with
// this formula" puts its card above the page. It also holds the student's own formula book and (for the teacher)
// the formula ideas collected from writing. The window moves, resizes from its corner, and expands to full screen.

// Old saved entries used letter codes (A-N-V); newer ones carry her card words.
const OLD_CODE: Record<string, MontessoriWordClass> = { A: 'article', N: 'noun', PN: 'propernoun', P: 'pronoun', V: 'verb', Adj: 'adjective', Adv: 'adverb', Pr: 'preposition', C: 'conjunction', I: 'interjection' };
const slotsFromOldCode = (code: string) => (/^[A-Za-z]+(-[A-Za-z]+)*$/.test(code) ? code.split('-').map((c) => OLD_CODE[c]).filter(Boolean) : []);

// A row of symbols with her card words above them ("article", "noun", "be"...), drawn like her formula cards.
export function FormulaSymbols({ slots, code, labels = false }: { slots?: string[]; code?: string; labels?: boolean }) {
  const list = slots ?? (code ? slotsFromOldCode(code) : []);
  return (
    <span className={`lm-writer-formula-symbols${labels ? ' labeled' : ''}`}>
      {list.map((s, i) => {
        const info = MONTESSORI_WORD_CLASS_INFO[slotClass(s)];
        if (!info) return null;
        return (
          <span key={i} className="lm-formula-slot">
            {labels && <span className="lm-formula-slot-label" style={{ color: info.color }}>{slotLabel(s)}</span>}
            <img src={info.imageUrl} alt={slotLabel(s)} title={slotLabel(s)} />
          </span>
        );
      })}
    </span>
  );
}

const slotsOf = (sentence: string) => sentenceSlots(tagForCheck(sentence), sentence);

function Versions({ sentence, showCode }: { sentence: string; showCode: boolean }) {
  const v = useMemo(() => tenseVersions(sentence), [sentence]);
  if (!v) return <p className="muted lm-formula-versions">This one doesn't change by time (a command, or a sentence with "can" or "should").</p>;
  return (
    <div className="lm-formula-versions">
      {(['past', 'present', 'future'] as const).map((t) => {
        const mine = slotsOf(v[t]);
        return (
          <div key={t} className="lm-formula-version">
            <span className="lm-formula-tense"><img src={TENSE_SYMBOLS[t].imageUrl} alt="" draggable={false} />{TENSE_SYMBOLS[t].name}</span>
            <FormulaSymbols slots={cardSlotsOf(mine)} />
            <span>{v[t]}{showCode && <span className="muted"> ({formulaCode(mine, v[t])})</span>}</span>
          </div>
        );
      })}
    </div>
  );
}

const WIN_KEY = 'lm-formulas-win';
type Win = { x: number; y: number; w: number; h: number };

export function SentenceFormulas({ level, book, onBook, ideas, onIdeas, showIdeas, onClose, onUse }: {
  level: 'A' | 'B' | 'C'; book: BookEntry[]; onBook: (b: BookEntry[]) => void; ideas: FormulaIdea[]; onIdeas: (i: FormulaIdea[]) => void; showIdeas: boolean; onClose: () => void;
  onUse: (f: { slots: string[]; sentence: string; code: string; card?: string }) => void;
}) {
  const showCode = level !== 'A';
  const units = useMemo(() => [...new Set(SENTENCE_FORMULAS.map((f) => f.unit))], []);
  const [tab, setTab] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [sentenceCards, setSentenceCards] = useState<Set<number>>(new Set());
  const [full, setFull] = useState(false);
  const [win, setWin] = useState<Win>(() => {
    try { const saved = JSON.parse(localStorage.getItem(WIN_KEY) ?? 'null'); if (saved) return saved; } catch { /* default */ }
    return { x: Math.max(16, window.innerWidth - 640), y: 90, w: 600, h: Math.min(680, window.innerHeight - 120) };
  });
  useEffect(() => { try { localStorage.setItem(WIN_KEY, JSON.stringify(win)); } catch { /* not remembered */ } }, [win]);
  const drag = (kind: 'move' | 'size') => (e: React.PointerEvent) => {
    if (full || (kind === 'move' && (e.target as HTMLElement).closest('button, input'))) return;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY, start = win;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      setWin(kind === 'move'
        ? { ...start, x: Math.max(0, Math.min(window.innerWidth - 120, start.x + dx)), y: Math.max(0, Math.min(window.innerHeight - 60, start.y + dy)) }
        : { ...start, w: Math.max(340, Math.min(window.innerWidth - start.x - 8, start.w + dx)), h: Math.max(280, Math.min(window.innerHeight - start.y - 8, start.h + dy)) });
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const toggle = (k: string) => setOpen((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  // Search: words in the formula, model sentence, code or lesson; a typed sentence finds the cards with its
  // pattern (the same slots first, then the closest).
  const q = query.trim().toLowerCase();
  const typedSentence = q.split(/\s+/).length >= 2 && /[a-z]/.test(q) && !/^[a-z' ]*(noun|verb|article|adjective|adverb|pronoun|phrase)[a-z' ]*$/.test(q);
  const mine = useMemo(() => (typedSentence ? slotsOf(query) : null), [typedSentence, query]);
  const pattern = mine && mine.length ? { slots: cardSlotsOf(mine), code: formulaCode(mine, query) } : null;
  const near = useMemo(() => (mine && mine.length ? new Map(formulasLike(mine, SENTENCE_FORMULAS.length).map(({ f, d }) => [f, d])) : null), [mine]);
  const formulas = SENTENCE_FORMULAS.map((f, i) => ({ f, i })).filter(({ f }) => {
    if (tab !== 'all' && tab !== f.unit) return false;
    if (!q) return true;
    if (near && (near.get(f) ?? 9) < 1.5) return true;
    return `${f.formula} ${f.sentence} ${f.code} ${f.lesson} ${f.unit}`.toLowerCase().includes(q);
  }).sort((a, b) => (near ? (near.get(a.f) ?? 9) - (near.get(b.f) ?? 9) : 0));
  const bookShown = book.filter((e) => !q || `${e.sentence} ${e.code} ${(e.slots ?? []).join(' ')}`.toLowerCase().includes(q) || e.code === pattern?.code);
  const ideasShown = ideas.filter((i) => !q || `${i.examples.join(' ')} ${i.code} ${(i.slots ?? []).join(' ')}`.toLowerCase().includes(q) || i.code === pattern?.code);
  const use = (f: SentenceFormula) => { onUse({ slots: f.slots, sentence: f.sentence, code: f.code, card: f.card }); };

  const style = full ? undefined : { left: win.x, top: win.y, width: win.w, height: win.h };
  return (
    <div className={`lm-formulas${full ? ' full' : ''}`} style={style} role="dialog" aria-label="Sentence formulas">
      <div className="lm-writer-checkwin-head" onPointerDown={drag('move')}>
        <strong>Sentence formulas</strong>
        <span className="lm-formulas-head-btns">
          <button type="button" className="lm-tool-btn" onClick={() => setFull((f) => !f)} aria-pressed={full} title={full ? 'Back to a window' : 'Full screen'}>{full ? '⤡ Smaller' : '⤢ Full screen'}</button>
          <button type="button" className="lm-float-x" onClick={onClose} aria-label="Close sentence formulas">×</button>
        </span>
      </div>
      <input className="lm-writer-input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder='Search, or type a sentence to find its formula ("the big dog ran")' aria-label="Search sentence formulas" />
      {pattern && (
        <span className="lm-formula-pattern">
          <span className="muted">Your sentence:</span> <FormulaSymbols slots={pattern.slots} labels />{showCode && <strong> {pattern.code}</strong>}
        </span>
      )}
      <div className="lm-formulas-tabs" role="tablist" aria-label="Formula units">
        {[['all', 'All'], ...units.map((u) => [u, `${u.match(/^\d+/)?.[0]}. ${u.replace(/^\d+\s*/, '')}`]), ['mine', `My formulas (${book.length})`], ...(showIdeas ? [['ideas', `Formula ideas (${ideas.length})`]] : [])].map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      <div className="lm-formulas-list">
        {tab === 'mine' ? (
          bookShown.length ? bookShown.map((e) => (
            <div key={e.code} className="lm-formula-row">
              <div className="lm-formula-body">
                <FormulaSymbols slots={e.slots} code={e.code} labels />
                <span><strong>{e.sentence}</strong>{showCode && <span className="muted"> {e.code}</span>}</span>
                <span className="muted">Added {e.at}</span>
                <span className="lm-writer-fixes">
                  {e.slots && <button type="button" className="lm-tool-btn" onClick={() => onUse({ slots: e.slots!, sentence: e.sentence, code: e.code })}>Write with this formula</button>}
                  <button type="button" className="lm-tool-btn" onClick={() => toggle(`b${e.code}`)} aria-expanded={open.has(`b${e.code}`)}>Past, present, future {open.has(`b${e.code}`) ? '▴' : '▾'}</button>
                  <button type="button" className="lm-tool-btn" onClick={() => onBook(removeFromBook(e.code))}>Remove</button>
                </span>
                {open.has(`b${e.code}`) && <Versions sentence={e.sentence} showCode={showCode} />}
              </div>
            </div>
          )) : <p className="muted">When the Sentence Check finds a correct sentence that isn't a formula yet, press "Add formula to my book" to keep it here.</p>
        ) : tab === 'ideas' ? (
          <>
            <p className="muted" style={{ margin: 0 }}>Correct sentences that match none of the formula cards, from your writing and your students'. Useful ones can become new formulas.</p>
            {ideasShown.map((i) => (
              <div key={i.code} className="lm-formula-row">
                <div className="lm-formula-body">
                  <FormulaSymbols slots={i.slots} code={i.code} labels />
                  <strong>{i.code}</strong>
                  <span>{i.count} {i.count === 1 ? 'sentence' : 'sentences'}{i.names.length ? ` · ${i.names.join(', ')}` : ''}</span>
                  <span className="muted">{i.examples.join(' / ')}</span>
                </div>
              </div>
            ))}
            {ideas.length > 0 && <button type="button" className="lm-tool-btn" onClick={() => { if (window.confirm('Clear the formula ideas list?')) { clearIdeas(); onIdeas([]); } }}>Clear list</button>}
          </>
        ) : formulas.length ? formulas.map(({ f, i }) => (
          <div key={i} className="lm-formula-row">
            <div className="lm-formula-body">
              <span className="lm-formula-meta">
                <strong>{f.lesson}</strong> · {f.unit.replace(/^\d+\s*/, '')}{showCode && <span className="lm-formula-code">{f.code}</span>}
                {near && near.get(f) === 0 && <span className="lm-formula-same">Same as your sentence</span>}
              </span>
              <button type="button" className="lm-formula-card" onClick={() => setSentenceCards((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })} title={sentenceCards.has(i) ? 'Show the formula card' : 'Show the sentence card'}>
                <img src={sentenceCards.has(i) ? f.sentenceCard : f.card} alt={sentenceCards.has(i) ? f.sentence : f.formula} loading="lazy" />
              </button>
              <span>{f.formula}</span>
              <span className="muted">Model: {f.sentence}</span>
              <span className="lm-writer-fixes">
                <button type="button" className="lm-tool-btn" onClick={() => use(f)}>Write with this formula</button>
                <button type="button" className="lm-tool-btn" onClick={() => toggle(`f${i}`)} aria-expanded={open.has(`f${i}`)}>Past, present, future {open.has(`f${i}`) ? '▴' : '▾'}</button>
              </span>
              {open.has(`f${i}`) && <Versions sentence={f.sentence} showCode={showCode} />}
            </div>
          </div>
        )) : <p className="muted">No formulas match "{query}".</p>}
      </div>
      {!full && <span className="lm-formulas-grip" onPointerDown={drag('size')} role="separator" aria-label="Drag to resize" title="Drag to resize">⇲</span>}
    </div>
  );
}
