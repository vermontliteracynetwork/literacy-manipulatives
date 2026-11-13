import './formulaPassage.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';
import { FormulaSymbols } from './SentenceFormulas';
import { GRAMMAR_SYMBOL_INFO, type SymbolWordClass } from '../lib/grammarSymbols';
import { checkSentence, splitSentences, tagEngine, tagForCheck, type SentenceSpan } from '../lib/writer/sentenceCheck';
import { readFormula, resetListed } from '../lib/writer/formulaLookup';
import { addCorrection, accuracy, corrections, removeCorrection, replaceCorrections, type Correction } from '../lib/writer/corrections';
import { addIdea, readIdeas, type FormulaIdea } from '../lib/writer/formulaBook';
import { addPractice, readPractice, writePractice, type PracticeSentence } from '../lib/writer/practice';
import { loadWords } from '../lib/writer/spell';
import { loadWordTypes } from '../lib/wordTypes';
import { isBlockedText } from '../lib/word-explorer/safety';
import { speak } from '../lib/word-explorer/speech';
import type { TaggedWord } from '../lib/writer/tagger';

// Formula Search, "Mark up a passage" tab (her requests 2026-11-13; a tab of Formula Search, not its own tool): paste any passage, student writing or public domain, and it is marked
// up like Write mode, with her grammar symbols over every word, broken into sentences, each with its formula code in
// her notation and whether that formula is in her list. It builds the formula base: new patterns go to the formula
// log, real sentences become practice sentences for their formula, and when the engine gets a word wrong, the
// teacher taps it and picks the right part of speech. Those corrections make the engine more accurate everywhere
// (src/lib/writer/corrections.ts), and the page shows how accurate it is on them.

const CLASSES = Object.keys(GRAMMAR_SYMBOL_INFO) as SymbolWordClass[];
const SAMPLE = 'The fox ran into the woods. A small bird sang in the old oak tree. My sister and I walked to the river after lunch. Because it was cold, we wore our warm coats. Did you see the moon last night? Wow! The stars were bright. Tomorrow we will go to the library.';
const today = () => new Date().toISOString().slice(0, 10);
type Kind = 'student' | 'public';

interface Row { span: SentenceSpan; words: TaggedWord[]; reading: ReturnType<typeof readFormula>; check?: ReturnType<typeof checkSentence>; blocked: boolean }

export function PassageTab() {
  const [text, setText] = useState('');
  const [passage, setPassage] = useState('');
  const [source, setSource] = useState('');
  const [kind, setKind] = useState<Kind>('public');
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState(0);
  const [fix, setFix] = useState<{ row: number; word: number } | null>(null);
  const [ideas, setIdeas] = useState<FormulaIdea[]>(readIdeas);
  const [practice, setPractice] = useState<Record<string, PracticeSentence[]>>(readPractice);
  const [message, setMessage] = useState('');
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { Promise.all([loadWords(), loadWordTypes()]).then(() => setReady(true)); }, []);

  const rows = useMemo<Row[]>(() => {
    if (!ready || !passage.trim()) return [];
    void version;
    return splitSentences(passage).map((span) => ({
      span, words: tagForCheck(span.text), reading: readFormula(span.text),
      check: kind === 'student' ? checkSentence(span) : undefined, blocked: isBlockedText(span.text),
    }));
  }, [passage, ready, version, kind]);

  // The formula base this passage adds to: each code once, how often it came up, and whether it is in her list.
  const base = useMemo(() => {
    const m = new Map<string, { code: string; inList: boolean; count: number; sentences: string[]; slots: string[] }>();
    for (const r of rows) {
      if (!r.reading) continue;
      const inList = r.reading.exact.length > 0;
      const code = inList ? r.reading.exact[0].code.replace(/\*$/, '') : r.reading.code;
      const cur = m.get(code) ?? { code, inList, count: 0, sentences: [], slots: r.reading.slots };
      cur.count++; cur.sentences.push(r.span.text);
      m.set(code, cur);
    }
    return [...m.values()].sort((a, b) => Number(a.inList) - Number(b.inList) || b.count - a.count);
  }, [rows]);
  const acc = useMemo(() => (ready ? accuracy(tagEngine) : { total: 0, alone: 0, learned: 0 }), [ready, version]);

  const correct = (r: Row, i: number, to: SymbolWordClass) => {
    addCorrection(r.words, i, to, r.span.text, tagEngine(r.span.text)[i]?.wordClass ?? r.words[i].wordClass);
    resetListed(); setFix(null); setVersion((v) => v + 1);
  };
  const keep = (code: string, sentence: string) => { setPractice(addPractice(code, { sentence, source: source.trim(), kind, at: today() })); };
  const logNew = (code: string, sentence: string, slots: string[]) => { setIdeas(addIdea(code, sentence, source.trim(), slots)); };
  const exportBase = () => {
    const data = { kind: 'lm-formula-base', at: today(), corrections: corrections(), practice: readPractice(), ideas: readIdeas() };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
    a.download = `formula-base-${today()}.json`;
    a.click();
  };
  const importBase = async (f: File) => {
    try {
      const d = JSON.parse(await f.text()) as { corrections?: Correction[]; practice?: Record<string, PracticeSentence[]>; ideas?: FormulaIdea[] };
      if (d.corrections) { const seen = new Set(corrections().map((c) => JSON.stringify([c.sentence, c.word, c.prev, c.next]))); replaceCorrections([...corrections(), ...d.corrections.filter((c) => !seen.has(JSON.stringify([c.sentence, c.word, c.prev, c.next])))]); }
      if (d.practice) { const p = readPractice(); for (const [code, list] of Object.entries(d.practice)) for (const s of list) if (!(p[code] ?? []).some((x) => x.sentence === s.sentence)) p[code] = [...(p[code] ?? []), s]; writePractice(p); setPractice(p); }
      if (d.ideas) { for (const i of d.ideas) for (const ex of i.examples) addIdea(i.code, ex, i.names[0] ?? '', i.slots); setIdeas(readIdeas()); }
      resetListed(); setVersion((v) => v + 1); setMessage('Formula base file added.');
    } catch { setMessage('That file is not a formula base file.'); }
  };

  return (
    <div className="pb">
        <section className="wx-card">
          <form onSubmit={(e) => { e.preventDefault(); setPassage(text); setFix(null); }}>
            <label htmlFor="pb-text" className="wx-h2">Paste a passage</label>
            <p className="wx-muted">Student writing or a public domain passage. Each sentence gets its symbols and its formula code.</p>
            <textarea id="pb-text" className="wx-input pb-text" rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste or type a passage here" />
            <div className="pb-row">
              <div className="wx-choice-row" role="radiogroup" aria-label="Where the passage is from">
                <button type="button" role="radio" aria-checked={kind === 'student'} className={`wx-btn${kind === 'student' ? ' wx-btn-primary' : ''}`} onClick={() => setKind('student')}>Student writing</button>
                <button type="button" role="radio" aria-checked={kind === 'public'} className={`wx-btn${kind === 'public' ? ' wx-btn-primary' : ''}`} onClick={() => setKind('public')}>Public domain</button>
              </div>
              <input className="wx-input pb-source" value={source} onChange={(e) => setSource(e.target.value)} placeholder={kind === 'student' ? 'Student or assignment (optional)' : 'Title and author (optional)'} aria-label="Source" />
            </div>
            <div className="wx-lm-actions">
              <button type="submit" className="wx-btn wx-btn-primary" disabled={!text.trim()}>Mark it up</button>
              <button type="button" className="wx-btn" onClick={() => { setText(SAMPLE); setPassage(SAMPLE); setSource('Sample passage'); setKind('public'); }}>Try a sample</button>
            </div>
          </form>
        </section>

        {passage && !ready && <p role="status">Getting the dictionary ready...</p>}
        {rows.length > 0 && (
          <>
            <section className="wx-card pb-summary" aria-label="Summary">
              <span className="wx-fact">{rows.length} sentences</span>
              <span className="wx-fact">{rows.filter((r) => r.reading?.exact.length).length} use a formula in the list</span>
              <span className="wx-fact">{rows.filter((r) => r.reading && !r.reading.exact.length).length} new patterns</span>
              <span className="wx-fact">{rows.filter((r) => r.words.some((w) => w.unsure)).length} with a word to check</span>
            </section>

            <section className="pb-sentences" aria-label="Sentences">
              {rows.map((r, k) => {
                const inList = !!r.reading?.exact.length;
                const code = inList ? r.reading!.exact[0].code.replace(/\*$/, '') : r.reading?.code ?? '';
                const logged = ideas.some((i) => i.code === code);
                const kept = (practice[code] ?? []).some((p) => p.sentence === r.span.text);
                return (
                  <article key={k} className="wx-card pb-sentence">
                    <div className="pb-sentence-head">
                      <span className="pb-n">{k + 1}</span>
                      <button type="button" className="wx-speak" aria-label="Read this sentence" onClick={() => speak(r.span.text)}><Icon name="speaker" size={22} /></button>
                      {inList ? <span className="pb-tag in">In the list: {code}</span> : <span className="pb-tag new">New formula: {code}</span>}
                      {r.blocked && <span className="pb-tag warn">Has a word on the kid-safe list</span>}
                    </div>
                    <Marked words={r.words} text={r.span.text} onPick={(i) => setFix(fix && fix.row === k && fix.word === i ? null : { row: k, word: i })} picked={fix?.row === k ? fix.word : null} />
                    {fix?.row === k && r.words[fix.word] && (
                      <div className="pb-fix" role="group" aria-label={`Part of speech for ${r.words[fix.word].word}`}>
                        <span>What is <strong>{r.words[fix.word].word}</strong> in this sentence?</span>
                        <div className="wx-chips">
                          {CLASSES.map((c) => (
                            <button key={c} type="button" className={`wx-chip${r.words[fix.word].wordClass === c ? ' armed' : ''}`} onClick={() => correct(r, fix.word, c)}>
                              <img src={GRAMMAR_SYMBOL_INFO[c].imageUrl} alt="" width={22} height={22} />{GRAMMAR_SYMBOL_INFO[c].name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {r.reading && (
                      <div className="pb-formula">
                        <FormulaSymbols slots={r.reading.slots} labels />
                        {inList
                          ? <span className="wx-muted">{r.reading.exact[0].breakdown}. Example: {r.reading.exact[0].example} (Levels {r.reading.exact[0].levels.join(', ')})</span>
                          : <span className="wx-muted">Not in her list yet{r.reading.close.length ? `. Closest: ${r.reading.close.map((c) => c.code).join(', ')}` : ''}.</span>}
                      </div>
                    )}
                    {r.check && (
                      <ul className="pb-check" aria-label="Sentence Check">
                        {([['Complete', r.check.complete], ['Capital', r.check.capital], ['End mark', r.check.endMark], ['Match', r.check.match.ok], ['Time', r.check.time]] as [string, boolean][]).map(([n, ok]) => (
                          <li key={n} className={ok ? 'ok' : 'no'}><Icon name={ok ? 'check' : 'close'} size={16} />{n}</li>
                        ))}
                      </ul>
                    )}
                    {r.reading && !r.blocked && (
                      <div className="wx-lm-actions">
                        {!inList && (logged ? <span className="pb-tag in">In the formula log</span>
                          : <button type="button" className="wx-btn wx-btn-small wx-btn-primary" onClick={() => logNew(code, r.span.text, r.reading!.slots)}>Add to formula log</button>)}
                        {kept ? <span className="pb-tag in">Practice sentence for {code}</span>
                          : <button type="button" className="wx-btn wx-btn-small" onClick={() => keep(code, r.span.text)}>Keep as a practice sentence</button>}
                      </div>
                    )}
                  </article>
                );
              })}
            </section>

            <section className="wx-card" aria-labelledby="pb-base-h">
              <h2 id="pb-base-h" className="wx-h2">Formulas in this passage</h2>
              <table className="wx-table">
                <thead><tr><th scope="col">Code</th><th scope="col">Symbols</th><th scope="col">Times</th><th scope="col">In her list?</th><th scope="col"><span className="wx-sr">Actions</span></th></tr></thead>
                <tbody>{base.map((b) => (
                  <tr key={b.code}>
                    <td><strong>{b.code}</strong></td>
                    <td><FormulaSymbols slots={b.slots} /></td>
                    <td>{b.count}</td>
                    <td>{b.inList ? 'Yes' : 'New'}</td>
                    <td>{!b.inList && !ideas.some((i) => i.code === b.code) && <button type="button" className="wx-btn wx-btn-small" onClick={() => b.sentences.forEach((s) => logNew(b.code, s, b.slots))}>Add to formula log</button>}</td>
                  </tr>
                ))}</tbody>
              </table>
              {base.some((b) => !b.inList) && (
                <button type="button" className="wx-btn wx-btn-primary" onClick={() => rows.forEach((r) => { if (r.reading && !r.reading.exact.length && !r.blocked) logNew(r.reading.code, r.span.text, r.reading.slots); })}>Add every new formula to the log</button>
              )}
            </section>
          </>
        )}

        <section className="wx-card" aria-labelledby="pb-acc-h">
          <h2 id="pb-acc-h" className="wx-h2">Making the engine more accurate</h2>
          <p>Tap any word in a marked-up sentence to fix its symbol. Each fix teaches the engine: the same word in the same spot is read your way everywhere (Write mode, Formula Search, Word Explorer), and once two fixes agree, the word is read that way in other sentences too.</p>
          {acc.total > 0 ? (
            <p className="pb-acc">
              On your {acc.total} {acc.total === 1 ? 'fix' : 'fixes'}, the engine alone was right {Math.round((acc.alone / acc.total) * 100)}% of the time.
              With what it learned from your other fixes, it is right {Math.round((acc.learned / acc.total) * 100)}% of the time.
            </p>
          ) : <p className="wx-muted">No fixes yet.</p>}
          {corrections().length > 0 && (
            <details>
              <summary className="wx-btn">Your fixes ({corrections().length})</summary>
              <ul className="pb-fixes">{corrections().map((c, i) => (
                <li key={i}><strong>{c.word}</strong>: {GRAMMAR_SYMBOL_INFO[c.from]?.name ?? c.from} to {GRAMMAR_SYMBOL_INFO[c.to]?.name ?? c.to} <span className="wx-muted">in "{c.sentence}"</span>
                  <button type="button" className="wx-btn wx-btn-small" onClick={() => { removeCorrection(c); resetListed(); setVersion((v) => v + 1); }}>Undo</button></li>
              ))}</ul>
            </details>
          )}
          <p className="wx-muted">Fixes, practice sentences and the formula log are kept in this browser. Download them to keep a copy or share them with another teacher.</p>
          <div className="wx-lm-actions">
            <button type="button" className="wx-btn wx-btn-secondary" onClick={exportBase}>Download the formula base</button>
            <button type="button" className="wx-btn" onClick={() => file.current?.click()}>Add a formula base file</button>
            <input ref={file} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importBase(f); e.target.value = ''; }} />
          </div>
          {message && <p role="status">{message}</p>}
        </section>
    </div>
  );
}

// A sentence marked up like Write mode: her symbol over each word. Tap a word to fix its symbol.
function Marked({ words, text, onPick, picked }: { words: TaggedWord[]; text: string; onPick: (i: number) => void; picked: number | null }) {
  const out: React.ReactNode[] = [];
  let last = 0, i = 0;
  for (const m of text.matchAll(/[A-Za-z']+/g)) {
    const at = m.index ?? 0;
    if (at > last) out.push(<span key={`g${at}`} className="pb-gap">{text.slice(last, at)}</span>);
    const w = words[i];
    const k = i;
    const classes = w ? (w.parts?.length ? w.parts : [w.wordClass]) : [];
    out.push(
      <button key={`w${at}`} type="button" className={`pb-word${w?.unsure ? ' unsure' : ''}${picked === k ? ' on' : ''}`} onClick={() => onPick(k)}
        aria-label={`${m[0]}: ${classes.map((c) => GRAMMAR_SYMBOL_INFO[c]?.name ?? c).join(' and ')}. Tap to fix.`}>
        <span className="pb-syms">{classes.map((c, j) => <img key={j} src={GRAMMAR_SYMBOL_INFO[c]?.imageUrl} alt="" />)}</span>
        <span className="pb-text-word">{m[0]}</span>
      </button>,
    );
    last = at + m[0].length; i++;
  }
  if (last < text.length) out.push(<span key="end" className="pb-gap">{text.slice(last)}</span>);
  return <p className="pb-marked">{out}</p>;
}
