import './formulaPassage.css';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Icon } from './Icon';
import { splitSentences } from '../lib/writer/sentenceCheck';
import { readFormula } from '../lib/writer/formulaLookup';
import { slotLabel } from '../lib/writer/formulaMatch';
import { addIdea } from '../lib/writer/formulaBook';
import { addPractice } from '../lib/writer/practice';
import { addOccurrences, readOccurrences, removeOccurrence, type Occurrence } from '../lib/writer/formulaOccurrences';
import { SEED_BOOK, SEED_PASSAGES } from '../lib/writer/seedPassages';
import { loadWords } from '../lib/writer/spell';
import { loadWordTypes } from '../lib/wordTypes';
import { isBlockedText } from '../lib/word-explorer/safety';

// Formula Search, "Log Formulas" tab (her requests 2026-11-20): "change the mark up a passage to 'Log Formulas' and have
// that section just for an input and table view (simple dashboard like) of the data collected", and "i want the formulas
// to be ranked by number of times occured in scanned text from greatest to least. columns should be if it is documented
// in our curriculum (check or blank), formula code, formula (article + noun + verb), example (The dog ran.) number of
// occurances. if i click to open a line, it should open with all documented occurances in a sub list".
// The table starts with her 20 Daily Warm-Ups: Reading, Grade 1 passages (src/lib/writer/seedPassages.ts) and adds
// every passage she logs. Every sentence is read by the grammar engine each time the tab opens.

const today = () => new Date().toISOString().slice(0, 10);
type Kind = 'student' | 'public';
type Show = 'all' | 'list' | 'new';
const bare = (c: string) => c.replace(/\*$/, '');

interface Found { sentence: string; source: string; mine?: Occurrence }
interface Row { code: string; inList: boolean; formula: string; example: string; found: Found[] }

const SEED: Found[] = SEED_PASSAGES.flatMap((p) => splitSentences(p.text).map((s) => ({ sentence: s.text, source: `${SEED_BOOK}, p. ${p.page}, ${p.title}` })));

function tableRows(mine: Occurrence[]): Row[] {
  const all: Found[] = [...SEED, ...mine.map((o) => ({ sentence: o.sentence, source: o.source || (o.kind === 'student' ? 'Student writing' : 'Public domain'), mine: o }))];
  const m = new Map<string, Row>();
  for (const f of all) {
    if (isBlockedText(f.sentence)) continue;
    const r = readFormula(f.sentence);
    if (!r) continue;
    const her = r.exact[0];
    const code = her ? bare(her.code) : r.code;
    let row = m.get(code);
    if (!row) {
      row = { code, inList: !!her, formula: (her ? her.cardSlots : r.slots).map(slotLabel).join(' + '), example: her ? her.example : f.sentence, found: [] };
      m.set(code, row);
    }
    row.found.push(f);
  }
  return [...m.values()].sort((a, b) => b.found.length - a.found.length || a.code.localeCompare(b.code));
}

function downloadCsv(rows: Row[]) {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [['In our curriculum', 'Formula code', 'Formula', 'Example', 'Occurrences'], ...rows.map((r) => [r.inList ? 'Yes' : '', r.code, r.formula, r.example, String(r.found.length)])];
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
  const [mine, setMine] = useState<Occurrence[]>(readOccurrences);
  const [show, setShow] = useState<Show>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => { Promise.all([loadWords(), loadWordTypes()]).then(() => setReady(true)); }, []);

  const rows = useMemo(() => (ready ? tableRows(mine) : []), [ready, mine]);
  const shown = rows.filter((r) => show === 'all' || (show === 'list') === r.inList);
  const sentences = rows.reduce((n, r) => n + r.found.length, 0);

  const log = () => {
    const add: Occurrence[] = [];
    let inList = 0, fresh = 0;
    for (const s of splitSentences(text)) {
      const r = readFormula(s.text);
      if (!r || isBlockedText(s.text)) continue;
      add.push({ sentence: s.text, source: source.trim(), kind, at: today() });
      // The rest of the site uses these too: practice sentences under her formulas, new patterns in the formula log.
      if (r.exact.length) { addPractice(bare(r.exact[0].code), { sentence: s.text, source: source.trim(), kind, at: today() }); inList++; }
      else { addIdea(r.code, s.text, source.trim(), r.slots); fresh++; }
    }
    setMine(addOccurrences(add)); setText('');
    setMessage(`Logged ${add.length} ${add.length === 1 ? 'sentence' : 'sentences'}: ${inList} in our curriculum, ${fresh} new.`);
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
            <div className="wx-choice-row" role="radiogroup" aria-label="Show">
              {([['all', 'All'], ['list', 'In our curriculum'], ['new', 'New']] as [Show, string][]).map(([k, n]) => (
                <button key={k} type="button" role="radio" aria-checked={show === k} className={`wx-btn wx-btn-small${show === k ? ' wx-btn-primary' : ''}`} onClick={() => setShow(k)}>{n}</button>
              ))}
            </div>
            <button type="button" className="wx-btn wx-btn-small wx-btn-secondary" onClick={() => downloadCsv(shown)}>Download (spreadsheet)</button>
          </div>
          <p className="wx-muted pb-note">Starts with the 20 passages in {SEED_BOOK}. Most common formulas first. Tap a line to see every sentence.</p>
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
                          <li key={i}><span>{f.sentence}</span> <span className="wx-muted">{f.source}</span>
                            {f.mine && <button type="button" className="wx-btn wx-btn-small" onClick={() => setMine(removeOccurrence(f.mine!))}>Remove</button>}</li>
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
