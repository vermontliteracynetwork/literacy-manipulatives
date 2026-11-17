import { useEffect, useMemo, useState } from 'react';
import { HomeButton } from '../HomeButton';
import { GRAMMAR_SYMBOL_INFO, type SymbolWordClass } from '../../lib/grammarSymbols';
import { loadEngine, readText, readWithWhy } from '../../lib/grammarEngine';
import { JOB_RULES, multiJobWords, type JobRule, type MultiJobWord } from '../../lib/wordsByType';
import './wordJobs.css';

// Word Jobs (her request 2026-11-17: "remember how important the part of speech logic is for our curriculum ... a list
// view for words that have multiple functions in parts of speech, so we can create rules on how to know what type it
// is"). Every common word that can do more than one job, from the Symbolic Grammar Engine (the same logic every program
// uses), with the engine's rule card for each pair of jobs and a sentence checker that shows why each word got its job.

const name = (c: SymbolWordClass) => GRAMMAR_SYMBOL_INFO[c].name;
const PAGE = 120;

function Sym({ c, size = 26 }: { c: SymbolWordClass; size?: number }) {
  return <img src={GRAMMAR_SYMBOL_INFO[c].imageUrl} alt="" width={size} height={size} className="wj-sym" draggable={false} />;
}

function ReadSentence({ text }: { text: string }) {
  const words = readText(text);
  return (
    <span className="wj-read">
      {words.map((w, i) => (
        <span key={i} className="wj-read-word" style={{ ['--c' as string]: GRAMMAR_SYMBOL_INFO[w.wordClass].color }}>
          <Sym c={w.wordClass} size={22} />
          <span>{w.word}</span>
        </span>
      ))}
    </span>
  );
}

function RuleCard({ r }: { r: JobRule }) {
  return (
    <section className="wj-rule" aria-label={r.title}>
      <h2><Sym c={r.jobs[0]} /><Sym c={r.jobs[1]} /> {r.title}</h2>
      <ul>{r.rules.map((x) => <li key={x}>{x}</li>)}</ul>
      <div className="wj-examples">
        {r.examples.map(([a, b]) => (
          <div key={a} className="wj-example">
            <ReadSentence text={a} />
            <ReadSentence text={b} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function WordJobs() {
  const [list, setList] = useState<MultiJobWord[] | null>(null);
  const [pair, setPair] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [sentence, setSentence] = useState('');
  useEffect(() => { void loadEngine().then(() => setList(multiJobWords())); }, []);

  const counts = useMemo(() => JOB_RULES.map((r) => (list ?? []).filter((w) => r.jobs.every((j) => w.jobs.includes(j))).length), [list]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (list ?? []).filter((w) => (pair === null || JOB_RULES[pair].jobs.every((j) => w.jobs.includes(j))) && (!needle || w.word.startsWith(needle)));
  }, [list, pair, q]);
  const reading = sentence.trim() && list ? readWithWhy(sentence.trim()) : [];

  const downloadCsv = () => {
    const lines = [['word', 'jobs', 'common jobs'].join(','), ...rows.map((w) => [w.word, w.jobs.map(name).join(' / '), w.common.map(name).join(' / ')].join(','))];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = pair === null ? 'words-with-more-than-one-job.csv' : `${JOB_RULES[pair].title.replace(/\W+/g, '-').toLowerCase()}words.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="wj-page">
      <header className="lm-toolbar wj-toolbar">
        <HomeButton />
        <h1 className="lm-sidebar-title">Word Jobs</h1>
        <span className="wj-sub">Words that can be more than one part of speech, and how to tell which job they are doing</span>
      </header>
      <main className="wj-main">
        <section className="wj-check" aria-label="Check a sentence">
          <label htmlFor="wj-sentence"><strong>Check a sentence.</strong> Type one to see each word's job and why.</label>
          <input id="wj-sentence" type="text" value={sentence} onChange={(e) => setSentence(e.target.value)} placeholder="We take a walk after we walk home." />
          {reading.length > 0 && (
            <ol className="wj-why">
              {reading.map((r, i) => (
                <li key={i}><Sym c={r.type} size={24} /><strong>{r.word}</strong><span className="wj-job">{name(r.type)}</span><span>{r.why}</span></li>
              ))}
            </ol>
          )}
        </section>

        <nav className="wj-pairs" aria-label="Pairs of jobs">
          <button type="button" className={pair === null ? 'on' : ''} onClick={() => { setPair(null); setShown(PAGE); }}>All <span>{list?.length ?? ''}</span></button>
          {JOB_RULES.map((r, i) => (
            <button key={r.title} type="button" className={pair === i ? 'on' : ''} onClick={() => { setPair(i); setShown(PAGE); }}>
              <Sym c={r.jobs[0]} size={20} /><Sym c={r.jobs[1]} size={20} />{r.title} <span>{counts[i]}</span>
            </button>
          ))}
        </nav>

        {pair !== null && <RuleCard r={JOB_RULES[pair]} />}

        <section className="wj-list" aria-label="Words">
          <div className="wj-list-head">
            <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} placeholder="Find a word" aria-label="Find a word" />
            <span>{rows.length} words</span>
            <button type="button" className="btn btn-sm" onClick={downloadCsv} disabled={!rows.length}>Download list (CSV)</button>
          </div>
          {!list ? <p role="status">Loading the dictionary...</p> : (
            <table>
              <thead><tr><th scope="col">Word</th><th scope="col">Jobs it can do (most common first)</th></tr></thead>
              <tbody>
                {rows.slice(0, shown).map((w) => (
                  <tr key={w.word}>
                    <th scope="row"><a href={`/words?w=${encodeURIComponent(w.word)}`}>{w.word}</a></th>
                    <td>
                      <span className="wj-jobs">
                        {w.jobs.map((j) => (
                          <span key={j} className={`wj-chip${w.common.includes(j) ? '' : ' rare'}`} title={w.common.includes(j) ? name(j) : `${name(j)} (less common)`}>
                            <Sym c={j} size={20} />{name(j)}{!w.common.includes(j) && <small> less common</small>}
                          </span>
                        ))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {rows.length > shown && <button type="button" className="btn btn-sm wj-more" onClick={() => setShown((n) => n + PAGE)}>Show more ({rows.length - shown} left)</button>}
        </section>
      </main>
    </div>
  );
}
