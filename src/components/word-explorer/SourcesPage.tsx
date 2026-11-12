import { useState } from 'react';
import { readReports, writeReports, type Report } from '../../lib/word-explorer/settings';
import { newId } from '../../lib/procedures/types';

// Sources and licenses (spec Phase 5: an attribution page listing every source and license), and the teacher's
// "Report a problem" reports.

const SOURCES: { what: string; source: string; license: string; url?: string; note?: string }[] = [
  { what: 'Meanings, examples, synonyms, opposites, word families', source: 'Open English WordNet (2024 edition)', license: 'CC BY 4.0', url: 'https://github.com/globalwordnet/english-wordnet', note: 'Filtered to everyday words and kid-safe; trimmed to the most common meanings. Credit: public/word-explorer/OEWN-LICENSE.txt' },
  { what: 'Parts of speech used by the word type engine', source: 'Princeton WordNet 3.0', license: 'WordNet 3.0 license (keep notice)', url: 'https://wordnet.princeton.edu/license-and-commercial-use', note: 'public/writer/WORDNET-LICENSE.txt' },
  { what: 'Letter-sound tiles, syllables, sound search', source: 'CMU Pronouncing Dictionary', license: 'BSD-style (CMU), commercial use allowed', url: 'https://github.com/cmusphinx/cmudict', note: 'public/word-explorer/CMUDICT-LICENSE.txt' },
  { what: 'Word list and frequency bands (stand-in until frequency counts are added)', source: 'SCOWL word lists (Kevin Atkinson)', license: 'SCOWL copyright notice', url: 'http://wordlist.aspell.net/', note: 'public/writer/WORDLIST-COPYRIGHT.txt' },
  { what: 'Pictures', source: 'Twemoji graphics', license: 'CC BY 4.0', url: 'https://github.com/jdecked/twemoji', note: 'public/word-explorer/TWEMOJI-LICENSE.txt' },
  { what: 'Font', source: 'Inclusive Sans by Olivia King', license: 'SIL Open Font License 1.1', url: 'https://github.com/LivKing/Inclusive-Sans' },
  { what: 'Font (personal preference)', source: 'OpenDyslexic', license: 'SIL Open Font License 1.1', url: 'https://opendyslexic.org/' },
  { what: 'Grammar symbols, formulas, formula cards, morpheme decks, starter definitions', source: 'Her Symbolic Grammar materials', license: 'Owned' },
  { what: 'Greek and Latin roots (forms and meanings only)', source: 'Her "111 Roots, Suffixes, and Prefixes" list', license: 'Author and license unknown; example words and activities not used' },
  { what: 'Live lookups (off unless a teacher allows them)', source: 'dictionaryapi.dev (Wiktionary text) and Datamuse', license: 'Hobby services with daily limits; to be replaced in the public version' },
];

export function SourcesPage({ teacher }: { teacher: boolean }) {
  const [reports, setReports] = useState<Report[]>(readReports);
  const save = (r: Report[]) => { writeReports(r); setReports(r); };
  const csv = () => {
    const q = (x: string) => `"${x.replace(/"/g, '""')}"`;
    const rows = [['Word', 'What', 'Note', 'Date', 'Fixed'], ...reports.map((r) => [r.word, r.part, r.note, r.at, r.fixed ? 'yes' : 'no'])];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.map((r) => r.map(q).join(',')).join('\n')], { type: 'text/csv' }));
    a.download = 'word-explorer-reports.csv';
    a.click();
  };
  return (
    <div className="wx-tab-stack">
      <section className="wx-card">
        <h1 className="wx-h1">Sources and licenses</h1>
        <p className="wx-muted">Every part of Word Explorer and where it comes from. Share-alike data is not used.</p>
        <table className="wx-table">
          <thead><tr><th scope="col">What</th><th scope="col">Source</th><th scope="col">License</th></tr></thead>
          <tbody>{SOURCES.map((s) => (
            <tr key={s.source}><td>{s.what}</td><td>{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.source}</a> : s.source}{s.note && <div className="wx-muted">{s.note}</div>}</td><td>{s.license}</td></tr>
          ))}</tbody>
        </table>
      </section>
      {teacher && (
        <section className="wx-card">
          <h2 className="wx-h2">Problem reports ({reports.filter((r) => !r.fixed).length} open)</h2>
          {reports.length === 0 ? <p className="wx-muted">No reports yet. Use "Report a problem" on a word page.</p> : (
            <>
              <ul className="wx-reports">{reports.map((r) => (
                <li key={r.id} className={r.fixed ? 'fixed' : ''}>
                  <a href={`/words?w=${encodeURIComponent(r.word)}`}><strong>{r.word}</strong></a> · {r.part} · {r.at}
                  {r.note && <p>{r.note}</p>}
                  <button type="button" className="wx-btn wx-btn-small" onClick={() => save(reports.map((x) => (x.id === r.id ? { ...x, fixed: !x.fixed } : x)))}>{r.fixed ? 'Reopen' : 'Mark fixed'}</button>
                  <button type="button" className="wx-btn wx-btn-small" onClick={() => save(reports.filter((x) => x.id !== r.id))}>Delete</button>
                </li>
              ))}</ul>
              <button type="button" className="wx-btn wx-btn-secondary" onClick={csv}>Download reports (spreadsheet)</button>
            </>
          )}
        </section>
      )}
    </div>
  );
}

const PARTS = ['Definition or explanation', 'Example sentence', 'Part of speech', 'Picture', 'Sounds', 'Word parts', 'Synonyms or opposites', 'Not kid-safe', 'Something else'];
// Teacher view: "Report a problem" on every word page (spec section 10).
export function ReportProblem({ word }: { word: string }) {
  const [open, setOpen] = useState(false);
  const [part, setPart] = useState(PARTS[0]);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  if (!open) return <button type="button" className="wx-btn wx-btn-small wx-report-btn" onClick={() => { setOpen(true); setSent(false); }}>Report a problem</button>;
  return (
    <form className="wx-report" onSubmit={(e) => {
      e.preventDefault();
      writeReports([{ id: newId(), word, part, note: note.trim(), at: new Date().toISOString().slice(0, 10) }, ...readReports()]);
      setSent(true); setOpen(false); setNote('');
    }}>
      <label className="wx-select-label">What is wrong?
        <select className="wx-input" value={part} onChange={(e) => setPart(e.target.value)}>{PARTS.map((p) => <option key={p}>{p}</option>)}</select>
      </label>
      <label className="wx-select-label">Note
        <textarea className="wx-input wx-textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="wx-lm-actions">
        <button type="submit" className="wx-btn wx-btn-primary">Send report</button>
        <button type="button" className="wx-btn" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {sent && <p role="status">Thank you. The report is on the Sources and reports page.</p>}
    </form>
  );
}
