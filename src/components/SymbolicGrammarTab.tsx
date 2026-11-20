// Formula Search, private Symbolic Grammar tab (her request 2026-11-20): the log of every passage marked up and saved,
// read for curriculum development. How often each formula appears (counted at every level of its code and by kind of
// text), sentences with no formula in her list, the structures that are not sentences (titles, headers, captions,
// dialogue, informal speech), Beth's six questions for narrowing which formulas to teach as formulas (she approves),
// and every word with its symbol and real example sentences for Word Explorer. Kept only in this browser.

import './formulaPassage.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LINE_TYPE_INFO } from 'symbolic-grammar-engine/src/writer/passage';
import { GRAMMAR_SYMBOL_INFO } from '../lib/grammarSymbols';
import { TEXT_KINDS, exportCorpus, importCorpus, readCorpus, readReviews, removeSource, writeReview, PRIVATE_FLAG, type CorpusItem, type CorpusSource, type FormulaReview, type ReviewStatus, type TextKind } from '../lib/corpus/store';
import { csv, download, formulaRows, scoreFormula, structureRows, wordRows, type FormulaRow, type Level } from '../lib/corpus/report';

const today = () => new Date().toISOString().slice(0, 10);
const pct = (n: number) => `${(n * 100).toFixed(n < 0.1 ? 1 : 0)}%`;
const kindName = (k: TextKind) => TEXT_KINDS.find((t) => t.id === k)?.name.split(' (')[0] ?? k;
const STATUS: { id: ReviewStatus; name: string }[] = [
  { id: 'candidate', name: 'Candidate' }, { id: 'reviewed', name: 'Reviewed by Beth' }, { id: 'approved', name: 'Approved' }, { id: 'not now', name: 'Not now' },
];
type Section = 'formulas' | 'new' | 'review' | 'structures' | 'words' | 'sources';

export function SymbolicGrammarTab({ onHide }: { onHide: () => void }) {
  const [data, setData] = useState<{ sources: CorpusSource[]; items: CorpusItem[] } | null>(null);
  const [reviews, setReviews] = useState<Record<string, FormulaReview>>(readReviews);
  const [section, setSection] = useState<Section>('formulas');
  const [level, setLevel] = useState<Level>('full');
  const [kind, setKind] = useState<TextKind | 'all'>('all');
  const [wordQuery, setWordQuery] = useState('');
  const [message, setMessage] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const load = () => readCorpus().then(setData).catch(() => setData({ sources: [], items: [] }));
  useEffect(() => { void load(); }, []);

  const sources = useMemo(() => data?.sources ?? [], [data]);
  const items = useMemo(() => data?.items ?? [], [data]);
  const rows = useMemo(() => formulaRows(items, sources, level, kind), [items, sources, level, kind]);
  const fullRows = useMemo(() => formulaRows(items, sources, 'full', 'all'), [items, sources]);
  const newRows = fullRows.filter((r) => !r.inList);
  const structures = useMemo(() => structureRows(items), [items]);
  const words = useMemo(() => wordRows(items, sources), [items, sources]);
  const shownWords = words.filter((w) => !wordQuery.trim() || w.word.startsWith(wordQuery.trim().toLowerCase())).slice(0, 200);
  const sentences = items.filter((i) => i.type === 'sentence').length;
  // Formulas to review: every formula not in her list, plus any she has already started reviewing.
  const reviewRows = fullRows.filter((r) => !r.inList || reviews[r.code]);

  const review = (code: string, change: Partial<FormulaReview>) => {
    const was: FormulaReview = reviews[code] ?? { status: 'candidate', notes: '', at: '' };
    setReviews(writeReview(code, { ...was, ...change }));
  };

  const downloadLog = () => {
    const byId = new Map(sources.map((s) => [s.id, s]));
    download(`symbolic-grammar-sentence-log-${today()}.csv`, csv([
      ['Source', 'Kind of text', 'License', 'Line', 'Line type', 'Text', 'Job', 'Formula code', 'In her list', 'Closest formulas', 'Dialogue', 'Informal speech'],
      ...items.map((i) => { const s = byId.get(i.sourceId); return [s?.title ?? '', s ? kindName(s.textKind) : '', s?.license ?? '', i.line, LINE_TYPE_INFO[i.type].name, i.text, i.job ?? '', i.inList ? i.listed : i.code, i.inList ? 'Yes' : i.type === 'sentence' ? 'No' : '', i.closest.join(' '), i.dialogue ? 'Yes' : '', i.informal ? 'Yes' : '']; }),
    ]));
  };
  const downloadFrequency = () => download(`formula-frequency-${level}-${today()}.csv`, csv([
    ['Formula code', 'Sentences', 'Share of sentences', 'Sources', 'Kinds of text', 'In learner writing', 'In everyday writing', 'In her list', 'Review', 'Examples'],
    ...rows.map((r) => [r.code, r.count, pct(r.share), r.sources, r.kinds.map(kindName).join('; '), r.learner, r.everyday, r.inList ? 'Yes' : 'No', reviews[r.code]?.status ?? '', r.examples.map((e) => e.text).join(' / ')]),
  ]));
  const downloadApproved = () => download(`approved-formulas-${today()}.csv`, csv([
    ['Formula code', 'Status', 'Sentences', 'Kinds of text', 'Notes', 'Examples', 'Date'],
    ...Object.entries(reviews).map(([code, r]) => { const row = fullRows.find((x) => x.code === code); return [code, r.status, row?.count ?? 0, row?.kinds.map(kindName).join('; ') ?? '', r.notes, row?.examples.map((e) => e.text).join(' / ') ?? '', r.at]; }),
  ]));
  const downloadWords = () => download(`word-explorer-examples-${today()}.json`, JSON.stringify({ kind: 'sg-word-examples', at: today(), words: words.filter((w) => w.examples.length) }, null, 1), 'application/json');

  if (!data) return <p role="status">Opening your Symbolic Grammar log...</p>;

  return (
    <div className="sg">
      <section className="wx-card sg-head">
        <h2 className="wx-h2">Symbolic Grammar (private)</h2>
        <p className="wx-muted">Your log of every passage you saved from Mark up a passage. It is kept only in this browser on this computer and is never sent anywhere. Download it to keep a copy or move it to another computer.</p>
        <div className="pb-summary">
          <span className="wx-fact">{sources.length} passages</span>
          <span className="wx-fact">{items.length} lines</span>
          <span className="wx-fact">{sentences} sentences</span>
          <span className="wx-fact">{fullRows.filter((r) => r.inList).length} of her formulas found</span>
          <span className="wx-fact">{newRows.length} patterns not in her list</span>
        </div>
        <div className="wx-lm-actions">
          <button type="button" className="wx-btn wx-btn-secondary" disabled={!items.length} onClick={downloadLog}>Download the sentence log (spreadsheet)</button>
          <button type="button" className="wx-btn" disabled={!items.length} onClick={() => void exportCorpus().then((j) => download(`symbolic-grammar-log-${today()}.json`, j, 'application/json'))}>Download everything (file)</button>
          <button type="button" className="wx-btn" onClick={() => file.current?.click()}>Add a log file</button>
          <input ref={file} type="file" accept=".json,application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { const n = await importCorpus(await f.text()); setMessage(`${n} passages added.`); setReviews(readReviews()); void load(); } catch { setMessage('That file is not a Symbolic Grammar log file.'); } }} />
          <button type="button" className="wx-btn" onClick={() => { try { localStorage.removeItem(PRIVATE_FLAG); } catch { /* fine */ } onHide(); }}>Hide this tab</button>
        </div>
        {message && <p role="status">{message}</p>}
        {!items.length && <p>Nothing saved yet. Mark up a passage, then tap "Save to my Symbolic Grammar log".</p>}
      </section>

      {items.length > 0 && <>
        <div className="fs-tabs sg-tabs" role="tablist" aria-label="Parts of the log">
          {([['formulas', 'Formula frequency'], ['new', `Not in her list (${newRows.length})`], ['review', 'Narrow and approve'], ['structures', 'Structures'], ['words', 'Words'], ['sources', `Passages (${sources.length})`]] as [Section, string][]).map(([id, name]) => (
            <button key={id} type="button" role="tab" aria-selected={section === id} className={`wx-btn${section === id ? ' wx-btn-primary' : ''}`} onClick={() => setSection(id)}>{name}</button>
          ))}
        </div>

        {section === 'formulas' && (
          <section className="wx-card" aria-labelledby="sg-f-h">
            <h2 id="sg-f-h" className="wx-h2">How often each formula appears</h2>
            <p className="wx-muted">Count by the whole code, by its core (S1, S2...), or by its job (statement, question...). A long sentence counts toward the shorter formulas it is built on when you count by core or job.</p>
            <div className="pb-row pb-details">
              <label className="wx-select-label">Count by
                <select className="wx-input" value={level} onChange={(e) => setLevel(e.target.value as Level)}>
                  <option value="full">Whole formula code</option><option value="core">Core (S1, Q2...)</option><option value="job">Job (S, Q, C, E)</option>
                </select>
              </label>
              <label className="wx-select-label">Kind of text
                <select className="wx-input" value={kind} onChange={(e) => setKind(e.target.value as TextKind | 'all')}>
                  <option value="all">All</option>{TEXT_KINDS.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                </select>
              </label>
              <button type="button" className="wx-btn wx-btn-secondary" onClick={downloadFrequency}>Download (spreadsheet)</button>
            </div>
            <FormulaTable rows={rows} reviews={reviews} showList={level === 'full'} />
          </section>
        )}

        {section === 'new' && (
          <section className="wx-card" aria-labelledby="sg-n-h">
            <h2 id="sg-n-h" className="wx-h2">Sentences with no formula in her list</h2>
            <p className="wx-muted">Grouped by pattern, most common first, with her closest formulas (one part different). The biggest groups are the formulas to consider adding (D-22).</p>
            <FormulaTable rows={newRows} reviews={reviews} showList={false} onReview={(code) => { review(code, {}); setSection('review'); }} />
          </section>
        )}

        {section === 'review' && (
          <section className="wx-card" aria-labelledby="sg-r-h">
            <h2 id="sg-r-h" className="wx-h2">Narrow and approve</h2>
            <p className="wx-muted">Beth's six questions for teaching a pattern as a formula. The log answers the first two; you answer the other four. A pattern whose parts do not stay in the same order is craft, not a formula. Only you approve.</p>
            <ol className="sg-questions">
              <li><strong>Common:</strong> in two or more kinds of text and three or more passages (from the log)</li>
              <li><strong>Needed:</strong> in learner writing or everyday writing (from the log)</li>
              <li><strong>Fixed:</strong> its parts always come in the same order</li>
              <li><strong>Symbols:</strong> it can be built from the symbols learners already have</li>
              <li><strong>Order:</strong> it builds on formulas already taught</li>
              <li><strong>Standard:</strong> Common Core or everyday writing expects it</li>
            </ol>
            {!reviewRows.length ? <p>No patterns to review yet.</p> : (
              <div className="sg-table-wrap"><table className="wx-table sg-table">
                <thead><tr><th scope="col">Formula</th><th scope="col">Sentences</th><th scope="col">Common</th><th scope="col">Needed</th><th scope="col">Fixed</th><th scope="col">Symbols</th><th scope="col">Order</th><th scope="col">Standard</th><th scope="col">Beth's advice</th><th scope="col">Status</th><th scope="col">Notes</th></tr></thead>
                <tbody>{reviewRows.map((r) => {
                  const rv = reviews[r.code];
                  const sc = scoreFormula(r, rv);
                  const yn = (k: 'fixed' | 'symbols' | 'order' | 'standard') => (
                    <select className="wx-input sg-yn" aria-label={`${k} for ${r.code}`} value={rv?.[k] === undefined ? '' : rv[k] ? 'yes' : 'no'} onChange={(e) => review(r.code, { [k]: e.target.value === '' ? undefined : e.target.value === 'yes' })}>
                      <option value="">?</option><option value="yes">Yes</option><option value="no">No</option>
                    </select>
                  );
                  return (
                    <tr key={r.code}>
                      <td><strong>{r.code}</strong><br /><span className="wx-muted">{r.examples[0]?.text}</span></td>
                      <td>{r.count}</td>
                      <td>{sc.common ? 'Yes' : 'No'}</td>
                      <td>{sc.needed ? 'Yes' : 'No'}</td>
                      <td>{yn('fixed')}</td><td>{yn('symbols')}</td><td>{yn('order')}</td><td>{yn('standard')}</td>
                      <td>{sc.advice} <span className="wx-muted">({sc.yes} of 6)</span></td>
                      <td><select className="wx-input" aria-label={`Status of ${r.code}`} value={rv?.status ?? 'candidate'} onChange={(e) => review(r.code, { status: e.target.value as ReviewStatus })}>{STATUS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></td>
                      <td><input className="wx-input" aria-label={`Notes for ${r.code}`} defaultValue={rv?.notes ?? ''} onBlur={(e) => { if (e.target.value !== (rv?.notes ?? '')) review(r.code, { notes: e.target.value }); }} /></td>
                    </tr>
                  );
                })}</tbody>
              </table></div>
            )}
            <button type="button" className="wx-btn wx-btn-secondary" disabled={!Object.keys(reviews).length} onClick={downloadApproved}>Download reviews and approvals (spreadsheet)</button>
          </section>
        )}

        {section === 'structures' && (
          <section className="wx-card" aria-labelledby="sg-s-h">
            <h2 id="sg-s-h" className="wx-h2">Structures, sentence and not</h2>
            <p className="wx-muted">Every line's type, structure first: titles, headers, list items, labels and captions, greetings, closings and source credits are counted here, with dialogue and informal speech.</p>
            <table className="wx-table">
              <thead><tr><th scope="col">Structure</th><th scope="col">Lines</th><th scope="col">Examples</th></tr></thead>
              <tbody>{structures.map((s) => (
                <tr key={s.type}><td><strong>{s.type in LINE_TYPE_INFO ? LINE_TYPE_INFO[s.type as keyof typeof LINE_TYPE_INFO].name : s.type === 'dialogue' ? 'Dialogue' : 'Informal speech'}</strong></td><td>{s.count}</td><td>{s.examples.join(' / ')}</td></tr>
              ))}</tbody>
            </table>
          </section>
        )}

        {section === 'words' && (
          <section className="wx-card" aria-labelledby="sg-w-h">
            <h2 id="sg-w-h" className="wx-h2">Words, their symbols and real sentences</h2>
            <p className="wx-muted">Every word in a saved sentence, with the symbol it had there and up to three example sentences for Word Explorer. Example sentences come only from public domain and openly licensed passages, never from learner writing.</p>
            <div className="pb-row">
              <input className="wx-input" type="search" value={wordQuery} onChange={(e) => setWordQuery(e.target.value)} placeholder="Find a word" aria-label="Find a word" />
              <button type="button" className="wx-btn wx-btn-secondary" onClick={downloadWords}>Download for Word Explorer (file)</button>
            </div>
            <table className="wx-table">
              <thead><tr><th scope="col">Word</th><th scope="col">Symbol</th><th scope="col">Times</th><th scope="col">Example sentences</th></tr></thead>
              <tbody>{shownWords.map((w) => (
                <tr key={`${w.word}|${w.symbol}`}>
                  <td><strong>{w.word}</strong></td>
                  <td><span className="sg-sym"><img src={GRAMMAR_SYMBOL_INFO[w.symbol]?.imageUrl} alt="" width={22} height={22} />{GRAMMAR_SYMBOL_INFO[w.symbol]?.name ?? w.symbol}</span></td>
                  <td>{w.count}</td>
                  <td>{w.examples.map((e) => <span key={e.text} className="sg-ex">{e.text} <span className="wx-muted">({e.source})</span></span>)}</td>
                </tr>
              ))}</tbody>
            </table>
            {words.length > shownWords.length && <p className="wx-muted">Showing {shownWords.length} of {words.length} words. Find a word to see others.</p>}
          </section>
        )}

        {section === 'sources' && (
          <section className="wx-card" aria-labelledby="sg-p-h">
            <h2 id="sg-p-h" className="wx-h2">Passages in the log</h2>
            <table className="wx-table">
              <thead><tr><th scope="col">Title</th><th scope="col">Kind of text</th><th scope="col">License</th><th scope="col">Grade band</th><th scope="col">Year</th><th scope="col">Lines</th><th scope="col">Sentences</th><th scope="col">Saved</th><th scope="col"><span className="wx-sr">Remove</span></th></tr></thead>
              <tbody>{sources.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.title}</strong></td><td>{kindName(s.textKind)}</td><td>{s.license}</td><td>{s.gradeBand}</td><td>{s.year}</td><td>{s.lines}</td><td>{s.sentences}</td><td>{s.addedAt.slice(0, 10)}</td>
                  <td><button type="button" className="wx-btn wx-btn-small" onClick={async () => { if (window.confirm(`Remove "${s.title}" and its ${s.lines} lines from the log?`)) { await removeSource(s.id); void load(); } }}>Remove</button></td>
                </tr>
              ))}</tbody>
            </table>
          </section>
        )}
      </>}
    </div>
  );
}

function FormulaTable({ rows, reviews, showList, onReview }: { rows: FormulaRow[]; reviews: Record<string, FormulaReview>; showList: boolean; onReview?: (code: string) => void }) {
  if (!rows.length) return <p>No sentences here yet.</p>;
  return (
    <div className="sg-table-wrap"><table className="wx-table sg-table">
      <thead><tr><th scope="col">Formula</th><th scope="col">Sentences</th><th scope="col">Share</th><th scope="col">Passages</th><th scope="col">Kinds of text</th><th scope="col">Learner</th><th scope="col">Everyday</th>{showList && <th scope="col">In her list</th>}{!showList && onReview && <th scope="col">Closest</th>}<th scope="col">Examples</th>{onReview && <th scope="col"><span className="wx-sr">Review</span></th>}</tr></thead>
      <tbody>{rows.map((r) => (
        <tr key={r.code}>
          <td><strong>{r.code}</strong>{reviews[r.code] && <><br /><span className="pb-tag in">{STATUS.find((s) => s.id === reviews[r.code].status)?.name}</span></>}</td>
          <td>{r.count}</td><td>{pct(r.share)}</td><td>{r.sources}</td><td>{r.kinds.map(kindName).join(', ')}</td><td>{r.learner}</td><td>{r.everyday}</td>
          {showList && <td>{r.inList ? 'Yes' : 'No'}</td>}
          {!showList && onReview && <td>{r.closest.join(', ')}</td>}
          <td>{r.examples.map((e) => <span key={e.text} className="sg-ex">{e.text} <span className="wx-muted">({e.source})</span></span>)}</td>
          {onReview && <td><button type="button" className="wx-btn wx-btn-small" onClick={() => onReview(r.code)}>{reviews[r.code] ? 'Open review' : 'Start review'}</button></td>}
        </tr>
      ))}</tbody>
    </table></div>
  );
}
