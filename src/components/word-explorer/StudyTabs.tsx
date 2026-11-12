import { useEffect, useState } from 'react';
import { PosTag, SpeakButton, Spoken, StatusTag, TapWord, useReader } from './parts';
import { ReviewButtons } from './ReviewButtons';
import { onReview, statusOf } from '../../lib/word-explorer/review';
import { patternLabel, patternTags, PATTERN_BY_ID, soundLabel, spellingsOfSound, SYLLABLE_TYPE_NOTES, tileLabel, tileSpeech, wordsWithPattern, type Grapheme } from '../../lib/word-explorer/phonics';
import { mainPos, wordMatrix, wordSum, WORD_PARTS_SOURCE, type Matrix, type Part, type WordSum } from '../../lib/word-explorer/morphology';
import { originOf, rootCandidates, rootOfWeek, rootsIn, ROOT_LIST_SOURCE } from '../../lib/word-explorer/roots';
import { visibleTo, type WordEntry } from '../../lib/word-explorer/types';
import { getEntry } from '../../lib/word-explorer/data';

// The Sounds, Word Parts and Pictures tabs of a word page (build spec 4.2, Phase 2).

function useReviewVersion() {
  const [v, setV] = useState(0);
  useEffect(() => onReview(() => setV((x) => x + 1)), []);
  return v;
}

// ---------- Sounds ----------
export function SoundsTab({ entry, teacher }: { entry: WordEntry; teacher: boolean }) {
  const { read } = useReader();
  const [pattern, setPattern] = useState<string | null>(null);
  const [more, setMore] = useState<string[]>([]);
  const ph = entry.phonics;
  useEffect(() => { if (pattern) wordsWithPattern(pattern).then((w) => setMore(w.filter((x) => x !== entry.headword).slice(0, 24))); }, [pattern, entry.headword]);
  if (!ph) return <p className="wx-empty-tab">Word Explorer does not have the sounds for this word yet.</p>;
  if (!visibleTo(ph.status, teacher)) return <p className="wx-waiting">The sounds for this word are waiting for a teacher to check them.</p>;
  const tags = patternTags({ graphemes: ph.value.graphemes, syllables: ph.value.syllables, uncertain: false });
  const chosen = pattern ? PATTERN_BY_ID.get(pattern) : undefined;
  const isVowel = (g: Grapheme) => /[ăĕĭŏŭāēīōūəoaeiu]|er|ar|or|air|ear|aw|oi|ow/.test(g.sound) && !['w', 'y'].includes(g.sound);
  return (
    <div className="wx-tab-stack">
      <section className="wx-card">
        <div className="wx-row-head">
          <h2 className="wx-h2">Letters and sounds</h2>
          {teacher && <StatusTag status={ph.status} />}
        </div>
        <p className="wx-muted">Tap a tile to hear it.</p>
        <ul className="wx-tiles">
          {ph.value.graphemes.map((g, i) => (
            <li key={i}>
              <button type="button" data-nosay className={`wx-tile${isVowel(g) ? ' vowel' : ''}`} aria-label={tileLabel(g)} onClick={() => read(`tile${i}`, tileSpeech(g, entry.headword))}>
                <span className="wx-tile-letters">{g.letters}</span>
                <span className="wx-tile-sound">{soundLabel(g.sound)}</span>
              </button>
            </li>
          ))}
        </ul>
        {teacher && entry.phonicsUncertain && <p className="wx-flag">Flagged for review: a spelling here is not on the pattern list. Check the tiles before approving.</p>}
        {teacher && <ReviewButtons statusKey={`${entry.id}:phonics`} status={ph.status} what="the sounds" />}
      </section>
      <section className="wx-card">
        <h2 className="wx-h2">Syllables</h2>
        <ol className="wx-syllables">
          {ph.value.syllables.map((s, i) => (
            <li key={i} className="wx-syllable">
              <SpeakButton id={`syl${i}`} text={s.text} label={`Say ${s.text}`} rate={0.6} />
              <span className="wx-syllable-text">{s.text}</span>
              <span className="wx-fact">{s.type}</span>
              <span className="wx-muted wx-syllable-note">{SYLLABLE_TYPE_NOTES[s.type]}</span>
            </li>
          ))}
        </ol>
      </section>
      <section className="wx-card">
        <h2 className="wx-h2">Patterns in this word</h2>
        <div className="wx-chips">
          {tags.map((t) => { const p = PATTERN_BY_ID.get(t); return p && (
            <button key={t} type="button" className={`wx-chip${pattern === t ? ' armed' : ''}`} aria-pressed={pattern === t} onClick={() => setPattern(pattern === t ? null : t)}>{patternLabel(p)}</button>
          ); })}
        </div>
        {chosen && (
          <div className="wx-pattern-more">
            <h3 className="wx-h3">More words with {patternLabel(chosen)}</h3>
            {more.length ? <div className="wx-chips">{more.map((w) => <TapWord key={w} word={w} />)}</div> : <p className="wx-muted">No other words found yet.</p>}
            {chosen.sound && (
              <>
                <h3 className="wx-h3">Other spellings of {soundLabel(chosen.sound)}</h3>
                <div className="wx-chips">
                  {spellingsOfSound(chosen.sound).filter((p) => p.id !== chosen.id).map((p) => (
                    <button key={p.id} type="button" className="wx-chip" onClick={() => setPattern(p.id)}>{p.letters || p.name}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------- Word Parts ----------
const KIND_NAME = { prefix: 'prefix', base: 'base', suffix: 'suffix' } as const;
function PartTile({ p }: { p: Part }) {
  const { read } = useReader();
  const meaning = p.meaning;
  return (
    <button type="button" data-nosay className={`wx-part wx-part-${p.kind}`} aria-label={meaning ? `${p.text}, ${KIND_NAME[p.kind]}, means ${meaning}` : `${p.text}, ${KIND_NAME[p.kind]}`}
      onClick={() => read(`part:${p.text}`, meaning ? `${p.text}. ${KIND_NAME[p.kind]}. It means ${meaning}.` : `${p.text}. ${KIND_NAME[p.kind]}.`)}>
      <span className="wx-part-text">{p.text}</span>
      <span className="wx-part-kind">{KIND_NAME[p.kind]}</span>
      {meaning && <span className="wx-part-meaning">{meaning}</span>}
    </button>
  );
}

// A base word's meaning comes from its own entry, and only once that meaning is approved (or in Teacher view).
function SumTiles({ sum, teacher }: { sum: WordSum; teacher: boolean }) {
  const base = sum.parts.find((p) => p.kind === 'base')?.text;
  const [baseMeaning, setBaseMeaning] = useState('');
  useEffect(() => {
    if (!base) return;
    getEntry(base).then((e) => setBaseMeaning(e?.senses.find((s) => visibleTo(s.definition.status, teacher))?.definition.value.split(';')[0] ?? ''));
  }, [base, teacher]);
  return (
    <div className="wx-sum">
      {sum.parts.map((p, i) => <span key={i} className="wx-sum-item">{i > 0 && <span className="wx-sum-op" aria-hidden="true">+</span>}<PartTile p={p.kind === 'base' ? { ...p, meaning: baseMeaning } : p} /></span>)}
      <span className="wx-sum-op" aria-hidden="true">→</span>
      <span className="wx-sum-result">{sum.word}</span>
    </div>
  );
}

export function WordPartsTab({ entry, teacher }: { entry: WordEntry; teacher: boolean }) {
  const word = entry.headword;
  const v = useReviewVersion();
  const [sum, setSum] = useState<WordSum | null | undefined>(undefined);
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  useEffect(() => {
    let live = true;
    wordSum(word).then(async (s) => {
      if (!live) return;
      setSum(s);
      const base = s?.parts.find((p) => p.kind === 'base')?.text ?? word;
      const m = await wordMatrix(base);
      if (live) setMatrix(m);
    });
    return () => { live = false; };
  }, [word]);
  const status = statusOf(`${word}:parts`, 'approved');
  const show = visibleTo(status, teacher);
  const roots = rootsIn(word);
  const week = rootOfWeek();
  const candidates = rootCandidates(week);
  void v;
  return (
    <div className="wx-tab-stack">
      <section className="wx-card">
        <div className="wx-row-head"><h2 className="wx-h2">Word sum</h2>{teacher && <StatusTag status={status} />}</div>
        {sum === undefined ? <p role="status">Finding the parts...</p> : !show ? <p className="wx-waiting">The word parts are waiting for a teacher to check them.</p> : sum ? (
          <>
            <SumTiles sum={sum} teacher={teacher} />
            <p className="wx-sum-text"><span className="wx-sr">Word sum: </span>{sum.sum}</p>
            {sum.notes.length > 0 && <p className="wx-muted">{sum.notes.join(' ')}</p>}
            {sum.posChange && (
              <p className="wx-pos-change">
                <span>{sum.posChange.from}</span>{sum.posChange.fromPos && <PosTag pos={sum.posChange.fromPos} />}
                <span>+ {sum.posChange.suffix} →</span><span>{word}</span><PosTag pos={sum.posChange.to} />
              </p>
            )}
          </>
        ) : (
          <p><Spoken id="base-note" text={`${word} is a base word. It has no prefix or suffix.`} /> <SpeakButton id="base-note" text={`${word} is a base word. It has no prefix or suffix.`} label="Read this" /></p>
        )}
        {teacher && <p className="wx-source-line">Source: {WORD_PARTS_SOURCE.source}. Meanings of parts: her morpheme decks.</p>}
        {teacher && <ReviewButtons statusKey={`${word}:parts`} status={status} what="the word parts" />}
      </section>

      {show && matrix && matrix.words.length > 0 && (
        <section className="wx-card">
          <h2 className="wx-h2">Word matrix for {matrix.base}</h2>
          <div className="wx-matrix" role="group" aria-label={`Word matrix for ${matrix.base}`}>
            <ul className="wx-matrix-col wx-matrix-pre" aria-label="Prefixes">{matrix.prefixes.map((p) => <li key={p}>{p}</li>)}</ul>
            <div className="wx-matrix-base">{matrix.base}</div>
            <ul className="wx-matrix-col wx-matrix-suf" aria-label="Suffixes">{matrix.suffixes.map((s) => <li key={s}>{s}</li>)}</ul>
          </div>
          <ul className="wx-matrix-words">
            {matrix.words.map((w) => (
              <li key={w.word}>
                <TapWord word={w.word} pos={mainPos(w.word)} />
                <span className="wx-sum-text">{w.sum}</span>
                {w.posChange && <span className="wx-muted">({w.posChange.suffix} makes {w.posChange.to === 'adjective' || w.posChange.to === 'adverb' ? 'an' : 'a'} {w.posChange.to})</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {teacher && roots.length > 0 && (
        <section className="wx-card">
          <div className="wx-row-head"><h2 className="wx-h2">Origin</h2><span className="wx-status wx-status-draft">Draft: needs a cited source</span></div>
          <p className="wx-muted">Students do not see this until it has a cited source and you approve it.</p>
          <ul>{roots.map((r) => <li key={r.id}><strong>{r.text}</strong> means "{r.meaning}" ({originOf(r)}). Spelling check passed; meaning check needs a cited etymology.</li>)}</ul>
          <p className="wx-source-line">Source: {ROOT_LIST_SOURCE.source}</p>
        </section>
      )}

      <section className="wx-card wx-root-week">
        <h2 className="wx-h2">Root of the week: {week.text}</h2>
        <p className="wx-lead"><Spoken id="root-week" text={`${week.text} means ${week.meaning}.`} /> <SpeakButton id="root-week" text={`${week.text} means ${week.meaning}.`} label="Read the root of the week" /></p>
        {teacher && <p className="wx-muted">Origin: {originOf(week)} <span className="wx-status wx-status-draft">Draft: needs a cited source</span></p>}
        <RootWords root={week.text} candidates={candidates} teacher={teacher} />
      </section>
    </div>
  );
}

function RootWords({ root, candidates, teacher }: { root: string; candidates: string[]; teacher: boolean }) {
  useReviewVersion();
  const words = candidates.filter((w) => teacher || statusOf(`root:${root}:${w}`, 'draft') === 'approved');
  if (!words.length) return <p className="wx-muted">Example words are waiting for a teacher to check them.</p>;
  return (
    <ul className="wx-root-words">
      {words.map((w) => {
        const st = statusOf(`root:${root}:${w}`, 'draft');
        const at = w.indexOf(root);
        return (
          <li key={w}>
            <TapWord word={w} />
            <span aria-hidden="true" className="wx-root-mark">{w.slice(0, at)}<mark>{root}</mark>{w.slice(at + root.length)}</span>
            {teacher && <StatusTag status={st} />}
            {teacher && <ReviewButtons statusKey={`root:${root}:${w}`} status={st} what={`${w} as a ${root} word`} compact />}
          </li>
        );
      })}
    </ul>
  );
}

// ---------- Pictures ----------
export function PicturesTab({ entry, teacher }: { entry: WordEntry; teacher: boolean }) {
  const senses = entry.senses.filter((s) => s.pictures.length && visibleTo(s.definition.status, teacher));
  if (!senses.length) return <p className="wx-empty-tab">There are no pictures for this word yet.</p>;
  return (
    <div className="wx-tab-stack">
      {senses.map((s) => (
        <section key={s.id} className="wx-card">
          <h2 className="wx-h2">{entry.headword} ({s.signpost})</h2>
          <div className="wx-pictures">
            {s.pictures.map((p) => (
              <figure key={p.assetId} className="wx-picture">
                <img src={p.assetId} alt={`${entry.headword} (${s.signpost})`} width={160} height={160} />
                <figcaption className="wx-source-line">
                  {p.provenance.map((pr) => <span key={pr.source}>{pr.url ? <a href={pr.url} target="_blank" rel="noreferrer">{pr.source}</a> : pr.source} ({pr.license})</span>)}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
