import './formulaPassage.css';
import { useEffect, useMemo, useState } from 'react';
import { FormulaSymbols } from './SentenceFormulas';
import { splitSentences } from '../lib/writer/sentenceCheck';
import { listedFormulas, readFormula } from '../lib/writer/formulaLookup';
import { addIdea, readIdeas, removeIdea, type FormulaIdea } from '../lib/writer/formulaBook';
import { addPractice, readPractice, removePractice, type PracticeSentence } from '../lib/writer/practice';
import { loadWords } from '../lib/writer/spell';
import { loadWordTypes } from '../lib/wordTypes';
import { isBlockedText } from '../lib/word-explorer/safety';

// Formula Search, "Log Formulas" tab (her request 2026-11-20: "change the mark up a passage to 'Log Formulas' and have
// that section just for an input and table view (simple dashboard like) of the data collected"). Paste a passage
// (student writing or public domain) and every sentence is logged by its formula: a sentence whose formula is in her
// list becomes a practice sentence for it, a new pattern goes to the formula log. Below, one table of everything
// collected so far. Kept in this browser (the same practice sentences and formula log the rest of the site uses).

const today = () => new Date().toISOString().slice(0, 10);
type Kind = 'student' | 'public';
type Show = 'all' | 'list' | 'new';
const bare = (c: string) => c.replace(/\*$/, '');

interface TableRow { code: string; slots: string[]; inList: boolean; count: number; example: string; sources: string[]; last: string }

function tableRows(practice: Record<string, PracticeSentence[]>, ideas: FormulaIdea[]): TableRow[] {
  const listed = new Map(listedFormulas().map((f) => [bare(f.code), f]));
  const rows: TableRow[] = Object.entries(practice).filter(([, l]) => l.length).map(([code, l]) => ({
    code, slots: listed.get(code)?.cardSlots ?? [], inList: true, count: l.length, example: l[l.length - 1].sentence,
    sources: [...new Set(l.map((p) => p.source || (p.kind === 'student' ? 'Student writing' : 'Public domain')))],
    last: l.map((p) => p.at).sort().pop() ?? '',
  }));
  for (const i of ideas) rows.push({ code: i.code, slots: i.slots ?? [], inList: false, count: i.count, example: i.examples[i.examples.length - 1] ?? '', sources: i.names, last: i.added ?? '' });
  return rows.sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}

function downloadCsv(rows: TableRow[]) {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [['Formula', 'In her list', 'Sentences', 'Latest sentence', 'Sources', 'Last added'], ...rows.map((r) => [r.code, r.inList ? 'Yes' : 'New', String(r.count), r.example, r.sources.join(' / '), r.last])];
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.map((l) => l.map(q).join(',')).join('\n')], { type: 'text/csv' }));
  a.download = `logged-formulas-${today()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function PassageTab() {
  const [text, setText] = useState('');
  const [source, setSource] = useState('');
  const [kind, setKind] = useState<Kind>('student');
  const [ready, setReady] = useState(false);
  const [ideas, setIdeas] = useState<FormulaIdea[]>(readIdeas);
  const [practice, setPractice] = useState<Record<string, PracticeSentence[]>>(readPractice);
  const [show, setShow] = useState<Show>('all');
  const [message, setMessage] = useState('');
  useEffect(() => { Promise.all([loadWords(), loadWordTypes()]).then(() => setReady(true)); }, []);

  const rows = useMemo(() => (ready ? tableRows(practice, ideas) : []), [ready, practice, ideas]);
  const shown = rows.filter((r) => show === 'all' || (show === 'list') === r.inList);
  const sentences = rows.reduce((n, r) => n + r.count, 0);

  const log = () => {
    let inList = 0, fresh = 0, skipped = 0;
    let p = practice, i = ideas;
    for (const s of splitSentences(text)) {
      const r = readFormula(s.text);
      if (!r || isBlockedText(s.text)) { skipped++; continue; }
      if (r.exact.length) { p = addPractice(bare(r.exact[0].code), { sentence: s.text, source: source.trim(), kind, at: today() }); inList++; }
      else { i = addIdea(r.code, s.text, source.trim(), r.slots); fresh++; }
    }
    setPractice(p); setIdeas(i); setText('');
    setMessage(`Logged ${inList + fresh} ${inList + fresh === 1 ? 'sentence' : 'sentences'}: ${inList} in her list, ${fresh} new.${skipped ? ` ${skipped} skipped.` : ''}`);
  };
  const remove = (r: TableRow) => {
    if (!window.confirm(`Remove ${r.code} and its ${r.count} ${r.count === 1 ? 'sentence' : 'sentences'} from the log?`)) return;
    if (r.inList) { let p = practice; for (const s of practice[r.code] ?? []) p = removePractice(r.code, s.sentence); setPractice({ ...p }); }
    else setIdeas(removeIdea(r.code));
  };

  return (
    <div className="pb">
      <section className="wx-card">
        <form onSubmit={(e) => { e.preventDefault(); log(); }}>
          <label htmlFor="pb-text" className="wx-h2">Paste a passage</label>
          <textarea id="pb-text" className="wx-input pb-text" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste or type a passage here" />
          <div className="pb-row">
            <div className="wx-choice-row" role="radiogroup" aria-label="Where the passage is from">
              <button type="button" role="radio" aria-checked={kind === 'student'} className={`wx-btn${kind === 'student' ? ' wx-btn-primary' : ''}`} onClick={() => setKind('student')}>Student writing</button>
              <button type="button" role="radio" aria-checked={kind === 'public'} className={`wx-btn${kind === 'public' ? ' wx-btn-primary' : ''}`} onClick={() => setKind('public')}>Public domain</button>
            </div>
            <input className="wx-input pb-source" value={source} onChange={(e) => setSource(e.target.value)} placeholder={kind === 'student' ? 'Student or assignment (optional)' : 'Title and author (optional)'} aria-label="Source" />
            <button type="submit" className="wx-btn wx-btn-primary" disabled={!text.trim() || !ready}>Log formulas</button>
          </div>
          {!ready && <p role="status" className="wx-muted">Getting the dictionary ready...</p>}
          {message && <p role="status" className="pb-msg">{message}</p>}
        </form>
      </section>

      <section className="pb-tiles" aria-label="Totals">
        <div className="pb-tile"><span className="pb-tile-n">{rows.length}</span><span>Formulas</span></div>
        <div className="pb-tile"><span className="pb-tile-n">{rows.filter((r) => r.inList).length}</span><span>In her list</span></div>
        <div className="pb-tile"><span className="pb-tile-n">{rows.filter((r) => !r.inList).length}</span><span>New formulas</span></div>
        <div className="pb-tile"><span className="pb-tile-n">{sentences}</span><span>Sentences</span></div>
      </section>

      <section className="wx-card" aria-labelledby="pb-log-h">
        <div className="pb-table-head">
          <h2 id="pb-log-h" className="wx-h2">Logged formulas</h2>
          <div className="wx-choice-row" role="radiogroup" aria-label="Show">
            {([['all', 'All'], ['list', 'In her list'], ['new', 'New']] as [Show, string][]).map(([k, n]) => (
              <button key={k} type="button" role="radio" aria-checked={show === k} className={`wx-btn wx-btn-small${show === k ? ' wx-btn-primary' : ''}`} onClick={() => setShow(k)}>{n}</button>
            ))}
          </div>
          <button type="button" className="wx-btn wx-btn-small wx-btn-secondary" disabled={!rows.length} onClick={() => downloadCsv(shown)}>Download (spreadsheet)</button>
        </div>
        {shown.length === 0 ? <p className="wx-muted">Nothing logged yet.</p> : (
          <div className="pb-scroll">
            <table className="wx-table pb-table">
              <thead><tr><th scope="col">Formula</th><th scope="col">Symbols</th><th scope="col">In her list</th><th scope="col">Sentences</th><th scope="col">Latest sentence</th><th scope="col">Source</th><th scope="col">Last added</th><th scope="col"><span className="wx-sr">Remove</span></th></tr></thead>
              <tbody>{shown.map((r) => (
                <tr key={`${r.inList}${r.code}`}>
                  <td><strong>{r.code}</strong></td>
                  <td>{r.slots.length > 0 && <FormulaSymbols slots={r.slots} />}</td>
                  <td>{r.inList ? 'Yes' : <span className="pb-tag new">New</span>}</td>
                  <td>{r.count}</td>
                  <td>{r.example}</td>
                  <td>{r.sources.join(', ')}</td>
                  <td>{r.last}</td>
                  <td><button type="button" className="wx-btn wx-btn-small" onClick={() => remove(r)}>Remove</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
