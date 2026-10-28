import { useEffect, useMemo, useState } from 'react';
import { MONTESSORI_WORD_CLASS_INFO, type MontessoriWordClass } from '../lib/montessoriGrammar';
import { SENTENCE_FORMULAS } from '../lib/writer/formulas';
import { tagInContext } from '../lib/writer/tagger';
import { CODE } from '../lib/writer/sentenceCheck';
import { tenseVersions } from '../lib/writer/tenses';
import { removeFromBook, clearIdeas, type BookEntry, type FormulaIdea } from '../lib/writer/formulaBook';

// Sentence Formulas (her request 2026-10-28): her formula list as a reference students can search, sorted by
// category in tabs, with each formula's model sentence opening into its past, present and future versions. It
// also holds the student's own formula book and (for the teacher) the formula ideas collected from writing.
// The window moves, resizes from its corner, and expands to the full screen.

const CODE_CLASS: Record<string, MontessoriWordClass> = { A: 'article', N: 'noun', PN: 'propernoun', P: 'pronoun', V: 'verb', Adj: 'adjective', Adv: 'adverb', Pr: 'preposition', C: 'conjunction', I: 'interjection' };
const codeTokens = (code: string) => code.split(/[-,;:·“”"!?\s]+/).filter(Boolean);
export const codeClasses = (code: string) => codeTokens(code).map((c) => CODE_CLASS[c]).filter(Boolean);
const codeOf = (sentence: string) => tagInContext(sentence).flatMap((w) => (w.parts && w.parts[1] !== 'adverb' ? w.parts : [w.wordClass]).map((c) => CODE[c] ?? 'N')).join('-');

export function FormulaSymbols({ code }: { code: string }) {
  return (
    <span className="lm-writer-formula-symbols">
      {codeClasses(code).map((c, i) => <img key={i} src={MONTESSORI_WORD_CLASS_INFO[c].imageUrl} alt={MONTESSORI_WORD_CLASS_INFO[c].name} title={MONTESSORI_WORD_CLASS_INFO[c].name} />)}
    </span>
  );
}

function Versions({ sentence, showCode }: { sentence: string; showCode: boolean }) {
  const v = useMemo(() => tenseVersions(sentence), [sentence]);
  if (!v) return <p className="muted lm-formula-versions">This one doesn't change by time (a command, or a sentence with "can" or "should").</p>;
  return (
    <div className="lm-formula-versions">
      {(['past', 'present', 'future'] as const).map((t) => (
        <div key={t} className="lm-formula-version">
          <span className="lm-formula-tense">{t === 'past' ? 'Past' : t === 'present' ? 'Present' : 'Future'}</span>
          <FormulaSymbols code={codeOf(v[t])} />
          <span>{v[t]}{showCode && <span className="muted"> ({codeOf(v[t])})</span>}</span>
        </div>
      ))}
    </div>
  );
}

const WIN_KEY = 'lm-formulas-win';
type Win = { x: number; y: number; w: number; h: number };

export function SentenceFormulas({ level, book, onBook, ideas, onIdeas, showIdeas, onClose }: {
  level: 'A' | 'B' | 'C'; book: BookEntry[]; onBook: (b: BookEntry[]) => void; ideas: FormulaIdea[]; onIdeas: (i: FormulaIdea[]) => void; showIdeas: boolean; onClose: () => void;
}) {
  const showCode = level !== 'A';
  const units = useMemo(() => [...new Set(SENTENCE_FORMULAS.map((f) => f.unit))], []);
  const [tab, setTab] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [full, setFull] = useState(false);
  const [win, setWin] = useState<Win>(() => {
    try { const saved = JSON.parse(localStorage.getItem(WIN_KEY) ?? 'null'); if (saved) return saved; } catch { /* default */ }
    return { x: Math.max(16, window.innerWidth - 600), y: 90, w: 560, h: Math.min(640, window.innerHeight - 120) };
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
        : { ...start, w: Math.max(320, Math.min(window.innerWidth - start.x - 8, start.w + dx)), h: Math.max(260, Math.min(window.innerHeight - start.y - 8, start.h + dy)) });
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const toggle = (k: string) => setOpen((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  // Search: words in the name, model, purpose or code; and a typed sentence finds the formulas with its pattern.
  const q = query.trim().toLowerCase();
  const pattern = q.split(/\s+/).length >= 2 && /[a-z]/.test(q) ? codeOf(query) : '';
  const formulas = SENTENCE_FORMULAS.map((f, i) => ({ f, i })).filter(({ f }) => {
    if (tab !== 'all' && tab !== f.unit) return false;
    if (!q) return true;
    const sameCode = pattern && codeTokens(f.code).join('-') === pattern;
    return sameCode || `${f.name} ${f.sentence} ${f.purpose} ${f.code} ${f.skill} ${f.unit} ${f.required}`.toLowerCase().includes(q);
  });
  const bookShown = book.filter((e) => !q || `${e.sentence} ${e.code}`.toLowerCase().includes(q) || e.code === pattern);
  const ideasShown = ideas.filter((i) => !q || `${i.examples.join(' ')} ${i.code}`.toLowerCase().includes(q) || i.code === pattern);

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
      {pattern && <span className="muted">Your sentence's pattern: <FormulaSymbols code={pattern} />{showCode && ` ${pattern}`}</span>}
      <div className="lm-formulas-tabs" role="tablist" aria-label="Formula categories">
        {[['all', 'All'], ...units.map((u) => [u, u.replace(/^\d+\s*/, '')]), ['mine', `My formulas (${book.length})`], ...(showIdeas ? [['ideas', `Formula ideas (${ideas.length})`]] : [])].map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      <div className="lm-formulas-list">
        {tab === 'mine' ? (
          bookShown.length ? bookShown.map((e) => (
            <div key={e.code} className="lm-formula-row">
              <FormulaSymbols code={e.code} />
              <div className="lm-formula-body">
                <strong>{e.sentence}</strong>{showCode && <span className="muted"> {e.code}</span>}
                <span className="muted">Added {e.at}</span>
                <span className="lm-writer-fixes">
                  <button type="button" className="lm-tool-btn" onClick={() => toggle(`b${e.code}`)} aria-expanded={open.has(`b${e.code}`)}>Past, present, future {open.has(`b${e.code}`) ? '▴' : '▾'}</button>
                  <button type="button" className="lm-tool-btn" onClick={() => onBook(removeFromBook(e.code))}>Remove</button>
                </span>
                {open.has(`b${e.code}`) && <Versions sentence={e.sentence} showCode={showCode} />}
              </div>
            </div>
          )) : <p className="muted">When the Sentence Check finds a correct sentence that isn't a formula yet, press "Add formula to my book" to keep it here.</p>
        ) : tab === 'ideas' ? (
          <>
            <p className="muted" style={{ margin: 0 }}>Correct sentences that match no formula yet, from your writing and your students'. Useful ones can become new formulas.</p>
            {ideasShown.map((i) => (
              <div key={i.code} className="lm-formula-row">
                <FormulaSymbols code={i.code} />
                <div className="lm-formula-body">
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
            <FormulaSymbols code={f.code} />
            <div className="lm-formula-body">
              <strong>{f.name}</strong>
              <span>{f.sentence}{showCode && <span className="muted"> ({f.code})</span>}</span>
              <span className="muted">{f.purpose} · {f.unit.replace(/^\d+\s*/, '')} {f.skill}</span>
              <button type="button" className="lm-tool-btn" onClick={() => toggle(`f${i}`)} aria-expanded={open.has(`f${i}`)}>Past, present, future {open.has(`f${i}`) ? '▴' : '▾'}</button>
              {open.has(`f${i}`) && <Versions sentence={f.sentence} showCode={showCode} />}
            </div>
          </div>
        )) : <p className="muted">No formulas match "{query}".</p>}
      </div>
      {!full && <span className="lm-formulas-grip" onPointerDown={drag('size')} role="separator" aria-label="Drag to resize" title="Drag to resize">⇲</span>}
    </div>
  );
}
