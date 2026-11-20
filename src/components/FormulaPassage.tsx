import './formulaPassage.css';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Icon } from './Icon';
import { formulaSentences } from '../lib/writer/sentenceCheck';
import { addIdea } from '../lib/writer/formulaBook';
import { addPractice } from '../lib/writer/practice';
import { addOccurrences, readOccurrences, removeOccurrence, type Occurrence } from '../lib/writer/formulaOccurrences';
import { herWordByWord, loadResearch, readResearch, type Research } from '../lib/writer/formulaResearch';
import { loadWords } from '../lib/writer/spell';
import { loadWordTypes } from '../lib/wordTypes';
import { isBlockedText } from '../lib/word-explorer/safety';

// Formula Search, "Log Formulas" tab (her requests 2026-11-20): "change the mark up a passage to 'Log Formulas' and have
// that section just for an input and table view (simple dashboard like) of the data collected"; "the formulas to be
// ranked by number of times occured in scanned text from greatest to least. columns should be if it is documented in
// our curriculum (check or blank), formula code, formula (article + noun + verb), example (The dog ran.) number of
// occurances. if i click to open a line, it should open with all documented occurances in a sub list"; "resize the
// columns so formula and example are the widest"; speech tags and incomplete sentences are never their own formula
// (the engine's formulaSentences); "dont just mark prepositional phrases when they can be broken into their parts of
// speech" and commas, colons, semicolons and apostrophes are part of the formula (wordByWord). It is for research only.
// The reading passages' sentences have every word's symbol checked by hand; sentences she logs use the engine's reading.

const today = () => new Date().toISOString().slice(0, 10);
type Kind = 'student' | 'public';
type Show = 'all' | 'list' | 'new';
const bare = (c: string) => c.replace(/\*$/, '');

interface Found { sentence: string; source: string; formula: string; reviewed: boolean; mine?: Occurrence }
interface Row { code: string; inList: boolean; formula: string; example: string; found: Found[] }

function tableRows(research: Research | null, mine: Occurrence[], book: string): Row[] {
  const m = new Map<string, Row>();
  const add = (text: string, classes: string[] | undefined, f: Omit<Found, 'formula' | 'sentence'>, units?: [number, number][]) => {
    if (isBlockedText(text)) return;
    const r = readResearch(text, classes, units);
    if (!r) return;
    let row = m.get(r.code);
    if (!row) { row = { code: r.code, inList: !!r.her, formula: r.her ? herWordByWord(r.her) : r.formula, example: r.her ? r.her.example : text, found: [] }; m.set(r.code, row); }
    row.found.push({ ...f, sentence: text, formula: r.formula });
  };
  for (const s of research?.sentences ?? []) {
    const b = research!.books[s.b];
    if (book !== 'all' && book !== b.id) continue;
    add(s.t, s.c, { source: `${b.name}, ${s.s}`, reviewed: true }, s.u);
  }
  if (book === 'all' || book === 'mine') for (const o of mine) add(o.sentence, undefined, { source: o.source || (o.kind === 'student' ? 'Student writing' : 'Public domain'), reviewed: false, mine: o });
  return [...m.values()].sort((a, b) => b.found.length - a.found.length || a.code.localeCompare(b.code));
}

function downloadCsv(rows: Row[]) {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [['In our curriculum', 'Formula code', 'Formula', 'Example', 'Occurrences', 'Sentence', 'Sentence formula', 'Source', 'Symbols checked'],
    ...rows.flatMap((r) => r.found.map((f, i) => [i ? '' : r.inList ? 'Yes' : '', r.code, i ? '' : r.formula, i ? '' : r.example, i ? '' : String(r.found.length), f.sentence, f.formula, f.source, f.reviewed ? 'Yes' : 'Engine only']))];
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
  const [research, setResearch] = useState<Research | null>(null);
  const [mine, setMine] = useState<Occurrence[]>(readOccurrences);
  const [show, setShow] = useState<Show>('all');
  const [book, setBook] = useState('all');
  const [open, setOpen] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => { Promise.all([loadWords(), loadWordTypes(), loadResearch()]).then(([, , r]) => { setResearch(r); setReady(true); }); }, []);

  const rows = useMemo(() => (ready ? tableRows(research, mine, book) : []), [ready, research, mine, book]);
  const shown = rows.filter((r) => show === 'all' || (show === 'list') === r.inList);
  const sentences = rows.reduce((n, r) => n + r.found.length, 0);

  const log = () => {
    const add: Occurrence[] = [];
    let inList = 0, fresh = 0;
    for (const s of formulaSentences(text)) {
      const r = readResearch(s.text);
      if (!r || isBlockedText(s.text)) continue;
      add.push({ sentence: s.text, source: source.trim(), kind, at: today() });
      // The rest of the site uses these too: practice sentences under her formulas, new patterns in the formula log.
      if (r.her) { addPractice(bare(r.her.code), { sentence: s.text, source: source.trim(), kind, at: today() }); inList++; }
      else { addIdea(r.code, s.text, source.trim()); fresh++; }
    }
    setMine(addOccurrences(add)); setText('');
    setMessage(`Logged ${add.length} complete ${add.length === 1 ? 'sentence' : 'sentences'}: ${inList} in our curriculum, ${fresh} new. Speech tags and incomplete sentences are not logged.`);
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
          {message && <p role="status" className="pb-msg">{message}</p>}
        </form>
      </section>

      {!ready ? <p role="status" className="wx-muted">Reading the passages...</p> : <>
        <section className="pb-tiles" aria-label="Totals">
          <div className="pb-tile"><span className="pb-tile-n">{rows.length}</span><span>Formulas</span></div>
          <div className="pb-tile"><span className="pb-tile-n">{rows.filter((r) => r.inList).length}</span><span>In our curriculum</span></div>
          <div className="pb-tile"><span className="pb-tile-n">{rows.filter((r) => !r.inList).length}</span><span>New formulas</span></div>
          <div className="pb-tile"><span className="pb-tile-n">{sentences}</span><span>Sentences</span></div>
        </section>

        <section className="wx-card" aria-labelledby="pb-log-h">
          <div className="pb-table-head">
            <h2 id="pb-log-h" className="wx-h2">Logged formulas</h2>
            <select className="wx-input pb-book" value={book} onChange={(e) => { setBook(e.target.value); setOpen(null); }} aria-label="Book">
              <option value="all">All passages</option>
              {research?.books.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              <option value="mine">Passages I logged</option>
            </select>
            <div className="wx-choice-row" role="radiogroup" aria-label="Show">
              {([['all', 'All'], ['list', 'In our curriculum'], ['new', 'New']] as [Show, string][]).map(([k, n]) => (
                <button key={k} type="button" role="radio" aria-checked={show === k} className={`wx-btn wx-btn-small${show === k ? ' wx-btn-primary' : ''}`} onClick={() => setShow(k)}>{n}</button>
              ))}
            </div>
            <button type="button" className="wx-btn wx-btn-small wx-btn-secondary" onClick={() => downloadCsv(shown)}>Download (spreadsheet)</button>
          </div>
          <p className="wx-muted pb-note">For research only. Most common formulas first; tap a line to see every sentence. Reading passages: every word's symbol checked by hand{research ? ` (${research.reviewed})` : ''}. Sentences you log use the engine's reading.</p>
          <div className="pb-scroll">
            <table className="wx-table pb-table">
              <thead><tr><th scope="col">In our curriculum</th><th scope="col">Formula code</th><th scope="col">Formula</th><th scope="col">Example</th><th scope="col">Occurrences</th></tr></thead>
              <tbody>{shown.map((r) => {
                const on = open === r.code;
                return (
                  <Fragment key={r.code}>
                    <tr className={`pb-line${on ? ' on' : ''}`} onClick={() => setOpen(on ? null : r.code)}>
                      <td className="pb-check-cell">{r.inList && <Icon name="check" size={22} />}<span className="wx-sr">{r.inList ? 'Yes' : 'No'}</span></td>
                      <td><button type="button" className="pb-open" aria-expanded={on} onClick={(e) => { e.stopPropagation(); setOpen(on ? null : r.code); }}><strong>{r.code}</strong></button></td>
                      <td>{r.formula}</td>
                      <td>{r.example}</td>
                      <td className="pb-count">{r.found.length}</td>
                    </tr>
                    {on && (
                      <tr className="pb-sub"><td colSpan={5}>
                        <ol className="pb-found">{r.found.map((f, i) => (
                          <li key={i}>
                            <span className="pb-found-s">{f.sentence}</span>
                            <span className="pb-found-f">{f.formula}</span>
                            <span className="wx-muted">{f.source}{f.reviewed ? '' : ' (engine reading, not checked)'}</span>
                            {f.mine && <button type="button" className="wx-btn wx-btn-small" onClick={() => setMine(removeOccurrence(f.mine!))}>Remove</button>}
                          </li>
                        ))}</ol>
                      </td></tr>
                    )}
                  </Fragment>
                );
              })}</tbody>
            </table>
          </div>
        </section>
      </>}
    </div>
  );
}
