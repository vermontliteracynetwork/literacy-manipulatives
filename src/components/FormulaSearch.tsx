import '@fontsource-variable/inclusive-sans/wght.css';
import './word-explorer/wordExplorer.css';
import './formulaSearch.css';
import { useEffect, useMemo, useState } from 'react';
import { Icon } from './Icon';
import { MainMenu } from './MainMenu';
import { FormulaSymbols } from './SentenceFormulas';
import { SENTENCE_FORMULAS, type SentenceFormula } from '../lib/writer/formulas';
import { splitSentences, tagForCheck } from '../lib/writer/sentenceCheck';
import { cardSlotsOf, formulaCode, formulasLike, sentenceSlots } from '../lib/writer/formulaMatch';
import { loadWords } from '../lib/writer/spell';
import { loadWordTypes } from '../lib/wordTypes';
import { addIdea, readIdeas, removeIdea, type FormulaIdea } from '../lib/writer/formulaBook';
import { speak } from '../lib/word-explorer/speech';

// Formula Search (her request 2026-11-12): one search bar, like a web search home page. Type any sentence and the
// formulas from her Formula Master List that match it appear. When none match, "Add suggested formula" logs the
// sentence's pattern (its formula code and symbols) in the formula log: every formula made this way that isn't in
// the main list, so the list can grow. The log is the same list as the Write mode's "Formula ideas".

interface Reading { sentence: string; slots: string[]; code: string; exact: SentenceFormula[]; close: SentenceFormula[] }

function readSentence(sentence: string): Reading | null {
  const mine = sentenceSlots(tagForCheck(sentence), sentence);
  if (!mine.length) return null;
  const ranked = formulasLike(mine, SENTENCE_FORMULAS.length);
  // The same formula code can sit on more than one card (taught in two lessons); show each code once.
  const once = (list: SentenceFormula[]) => list.filter((f, i) => list.findIndex((g) => g.code === f.code && g.formula === f.formula) === i);
  const code = formulaCode(mine, sentence);
  // A contraction formula (We're: P'V) only matches a sentence with that contraction, and the other way round.
  const sameShape = (f: SentenceFormula) => f.code.includes("'") === code.includes("'");
  return {
    sentence,
    slots: cardSlotsOf(mine),
    code,
    exact: once(ranked.filter((r) => r.d === 0 && sameShape(r.f)).map((r) => r.f)),
    close: once(ranked.filter((r) => (r.d > 0 && r.d <= 1) || (r.d === 0 && !sameShape(r.f))).map((r) => r.f)).slice(0, 3),
  };
}

const today = () => new Date().toISOString().slice(0, 10);
function downloadCsv(ideas: FormulaIdea[]) {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = [['Formula code', 'Formula', 'Example sentences', 'Times added', 'First added'], ...ideas.map((i) => [i.code, (i.slots ?? []).join(' '), i.examples.join(' / '), String(i.count), i.added ?? ''])];
  const blob = new Blob([rows.map((r) => r.map(q).join(',')).join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `formula-log-${today()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function FormulaSearch() {
  const [text, setText] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '');
  const [query, setQuery] = useState(text);
  const [ready, setReady] = useState(false);
  const [log, setLog] = useState<FormulaIdea[]>(readIdeas);
  const [showLog, setShowLog] = useState(false);

  useEffect(() => { document.title = 'Formula Search'; Promise.all([loadWords(), loadWordTypes()]).then(() => setReady(true)); }, []);
  const results = useMemo(() => (ready && query.trim() ? splitSentences(query).map((s) => readSentence(s.text)).filter((r): r is Reading => !!r) : []), [query, ready]);
  const go = (q: string) => {
    setQuery(q);
    window.history.replaceState(null, '', q.trim() ? `/formulas?q=${encodeURIComponent(q.trim())}` : '/formulas');
  };
  const searched = !!query.trim();

  return (
    <div className="wx fs" data-theme="light">
      <main className={`fs-main${searched ? ' searched' : ''}`}>
        <h1 className="fs-title"><a href="/formulas" onClick={(e) => { e.preventDefault(); setText(''); go(''); }}>Formula Search</a></h1>
        <form className="fs-bar" role="search" onSubmit={(e) => { e.preventDefault(); go(text); }}>
          <Icon name="search" size={24} />
          <label htmlFor="fs-q" className="wx-sr">Type a sentence</label>
          <input id="fs-q" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type any sentence" autoComplete="off" spellCheck={false} autoFocus />
          <button type="submit" className="wx-btn wx-btn-primary">Search</button>
        </form>
        {!searched && (
          <div className="fs-home-links">
            <button type="button" className="wx-btn" onClick={() => setShowLog((s) => !s)} aria-expanded={showLog}>Formula log ({log.length})</button>
          </div>
        )}

        {searched && !ready && <p role="status">Getting the dictionary ready...</p>}
        {searched && ready && results.length === 0 && <p className="fs-none">Type a sentence with at least one word.</p>}
        {results.map((r, i) => {
          const logged = log.find((x) => x.code === r.code);
          return (
            <section key={i} className="fs-result" aria-label={`Formulas for: ${r.sentence}`}>
              <div className="fs-sentence">
                <button type="button" className="wx-speak" aria-label="Read the sentence" onClick={() => speak(r.sentence)}><Icon name="speaker" size={22} /></button>
                <span className="fs-sentence-text">{r.sentence}</span>
              </div>
              <div className="fs-pattern">
                <FormulaSymbols slots={r.slots} labels />
                <span className="fs-code">{r.code}</span>
              </div>
              {r.exact.length > 0 ? (
                <>
                  <h2 className="wx-h2">{r.exact.length === 1 ? 'Matching formula' : `${r.exact.length} matching formulas`}</h2>
                  <ul className="fs-cards">{r.exact.map((f) => <FormulaCard key={`${f.lesson}-${f.code}-${f.card}`} f={f} />)}</ul>
                </>
              ) : (
                <div className="fs-nomatch">
                  <h2 className="wx-h2">No formula in the main list matches this sentence.</h2>
                  <p>Suggested formula: <strong>{r.code}</strong> ({r.slots.map((s) => (s === 'propernoun' ? 'proper noun' : s === 'phrase' ? 'prepositional phrase' : s)).join(' + ')})</p>
                  {logged ? (
                    <p className="fs-logged" role="status"><Icon name="check" size={20} /> In the formula log{logged.examples.includes(r.sentence) ? '' : ' (this sentence is new to it)'}.
                      {!logged.examples.includes(r.sentence) && <button type="button" className="wx-btn wx-btn-small" onClick={() => setLog(addIdea(r.code, r.sentence, '', r.slots))}>Add this sentence too</button>}
                    </p>
                  ) : (
                    <button type="button" className="wx-btn wx-btn-primary" onClick={() => setLog(addIdea(r.code, r.sentence, '', r.slots))}>Add suggested formula</button>
                  )}
                  {r.close.length > 0 && (
                    <>
                      <h3 className="wx-h3 fs-close-h">Close formulas (one part different)</h3>
                      <ul className="fs-cards">{r.close.map((f) => <FormulaCard key={`${f.lesson}-${f.code}-${f.card}`} f={f} />)}</ul>
                    </>
                  )}
                </div>
              )}
            </section>
          );
        })}
        {searched && (
          <div className="fs-home-links">
            <button type="button" className="wx-btn" onClick={() => setShowLog((s) => !s)} aria-expanded={showLog}>Formula log ({log.length})</button>
          </div>
        )}
        {showLog && (
          <section className="fs-log" aria-labelledby="fs-log-h">
            <h2 id="fs-log-h" className="wx-h2">Formula log</h2>
            <p className="wx-muted">Formulas added here that are not in the main Formula Master List, newest last. Kept in this browser, along with the Write mode's formula ideas. Download it to keep a copy or share it.</p>
            {log.length === 0 ? <p>No formulas yet. Search a sentence that has no formula, then tap "Add suggested formula".</p> : (
              <>
                <table className="fs-table">
                  <thead><tr><th scope="col">Code</th><th scope="col">Formula</th><th scope="col">Sentences</th><th scope="col">Added</th><th scope="col"><span className="wx-sr">Remove</span></th></tr></thead>
                  <tbody>
                    {log.map((i) => (
                      <tr key={i.code}>
                        <td><strong>{i.code}</strong></td>
                        <td><FormulaSymbols slots={i.slots} code={i.code} labels /></td>
                        <td>{i.examples.join(' / ')}</td>
                        <td>{i.added ?? ''}</td>
                        <td><button type="button" className="wx-btn wx-btn-small" onClick={() => { if (window.confirm(`Remove ${i.code} from the formula log?`)) setLog(removeIdea(i.code)); }}>Remove</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button type="button" className="wx-btn wx-btn-secondary" onClick={() => downloadCsv(log)}>Download the log (spreadsheet)</button>
              </>
            )}
          </section>
        )}
      </main>
      <MainMenu />
    </div>
  );
}

function FormulaCard({ f }: { f: SentenceFormula }) {
  return (
    <li className="fs-card">
      <img src={f.card} alt={`Formula card: ${f.formula}`} loading="lazy" />
      <div className="fs-card-text">
        <span className="fs-code">{f.code}</span>
        <span>{f.formula}</span>
        <span className="wx-muted">Model sentence: {f.sentence}</span>
        <span className="wx-muted">Lesson {f.lesson}, unit {f.unit}</span>
      </div>
    </li>
  );
}
