import { useContext, useEffect, useMemo, useState } from 'react';
import { PosSymbol, TapContext, TapWord, useReader, BAND_NAMES } from './parts';
import { listWords, loadLists, partsOf, TOPICS, wordPartsOf, type ListWord } from '../../lib/word-explorer/lists';
import { allPictures } from '../../lib/word-explorer/pictures';
import { PREFIXES, SUFFIXES } from '../../lib/word-explorer/morphology';
import { SOUNDS, soundLabel, spellingsOfSound } from '../../lib/word-explorer/phonics';
import type { PartOfSpeech } from '../../lib/word-explorer/types';

// Browse (build spec 4.3): A to Z with guide words, Pictures, Sounds and Topics, multi-select filters, and results
// as picture cards or a plain list (a per-student setting).

export type BrowseMode = 'az' | 'pictures' | 'sounds' | 'topics';
type Mode = BrowseMode;
const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
const POS: PartOfSpeech[] = ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'interjection', 'article'];
const PAGE = 60;

function Dropdown({ label, options, value, onChange }: { label: string; options: [string, string][]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <details className="wx-dropdown">
      <summary className={`wx-btn${value.length ? ' wx-btn-primary' : ''}`}>{label}{value.length ? ` (${value.length})` : ''}</summary>
      <div className="wx-dropdown-panel" role="group" aria-label={label}>
        {options.map(([v, name]) => (
          <label key={v}><input type="checkbox" checked={value.includes(v)} onChange={() => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])} /> {name}</label>
        ))}
        {value.length > 0 && <button type="button" className="wx-btn wx-btn-small" onClick={() => onChange([])}>Clear</button>}
      </div>
    </details>
  );
}

function WordCard({ w, pic }: { w: ListWord; pic?: string }) {
  const { armed, arm, open } = useContext(TapContext);
  const { read } = useReader();
  const on = armed === w.word;
  const pos = partsOf(w)[0];
  return (
    <button type="button" data-nosay className={`wx-wordcard${on ? ' armed' : ''}`} aria-label={on ? `${w.word}. Tap again to open its word page.` : `${w.word}. Tap to hear it, tap twice to open it.`}
      onClick={() => { if (on) { arm(null); open(w.word); } else { read(`card:${w.word}`, w.word); arm(w.word); } }}>
      {pic ? <img src={pic} alt="" /> : pos ? <PosSymbol pos={pos} size={56} decorative /> : null}
      <span>{w.word}</span>
      {on && <span className="wx-tap-hint">Tap again to open</span>}
    </button>
  );
}

export function Browse({ view, onView, initialMode = 'az' }: { view: 'cards' | 'list'; onView: (v: 'cards' | 'list') => void; initialMode?: Mode }) {
  const [ready, setReady] = useState(listWords().length > 0);
  const [pics, setPics] = useState<Record<string, { file: string }>>({});
  const [mode, setMode] = useState<Mode>(initialMode);
  const [letter, setLetter] = useState('a');
  const [sound, setSound] = useState<string | null>(null);
  const [topicPick, setTopicPick] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pos, setPos] = useState<string[]>([]);
  const [tier, setTier] = useState<string[]>([]);
  const [band, setBand] = useState<string[]>([]);
  const [topic, setTopic] = useState<string[]>([]);
  const [part, setPart] = useState<string[]>([]);
  const [picOnly, setPicOnly] = useState(false);
  useEffect(() => { loadLists().then(() => setReady(true)); allPictures().then(setPics); }, []);
  useEffect(() => setPage(0), [mode, letter, sound, topicPick, pos, tier, band, topic, part, picOnly]);

  const known = useMemo(() => new Set(listWords().map((w) => w.word)), [ready]);
  const results = useMemo(() => {
    if (!ready) return [];
    const soundIds = sound ? new Set(spellingsOfSound(sound).map((p) => p.id)) : null;
    return listWords().filter((w) => {
      if (mode === 'az' && !w.word.startsWith(letter)) return false;
      if ((mode === 'pictures' || picOnly) && !w.picture) return false;
      if (mode === 'sounds' && (!soundIds || !w.patterns.some((p) => soundIds.has(p)))) return false;
      if (mode === 'topics' && (!topicPick || w.topic !== topicPick)) return false;
      if (pos.length && !partsOf(w).some((p) => pos.includes(p))) return false;
      if (tier.length && !tier.includes(String(w.tier))) return false;
      if (band.length && !band.includes(String(w.band))) return false;
      if (topic.length && !topic.includes(w.topic)) return false;
      if (part.length && !wordPartsOf(w.word, (x) => known.has(x)).some((p) => part.includes(p))) return false;
      return true;
    }).sort((a, b) => (mode === 'az' ? a.word.localeCompare(b.word) : a.band - b.band || a.word.localeCompare(b.word)));
  }, [ready, mode, letter, sound, topicPick, pos, tier, band, topic, part, picOnly, known]);
  const shown = results.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.ceil(results.length / PAGE);
  const soundKeys = Object.keys(SOUNDS).filter((k) => k && spellingsOfSound(k).length > 0);
  const partOptions: [string, string][] = [...PREFIXES.map((p) => [`prefix:${p.text}`, `prefix ${p.text}`] as [string, string]), ...[...new Set(SUFFIXES.map((s) => s.text))].map((s) => [`suffix:${s}`, `suffix ${s}`] as [string, string])];

  return (
    <div className="wx-tab-stack">
      <section className="wx-card">
        <h1 className="wx-h1">Browse</h1>
        <div className="wx-browse-modes" role="tablist" aria-label="Browse by">
          {([['az', 'A to Z'], ['pictures', 'Pictures'], ['sounds', 'Sounds'], ['topics', 'Topics']] as [Mode, string][]).map(([m, label]) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} className={`wx-btn${mode === m ? ' wx-btn-primary' : ''}`} onClick={() => setMode(m)}>{label}</button>
          ))}
        </div>
      </section>

      {mode === 'az' && (
        <section className="wx-card">
          <div className="wx-letters" role="group" aria-label="Letters">
            {LETTERS.map((l) => <button key={l} type="button" className={`wx-letter${letter === l ? ' on' : ''}`} aria-pressed={letter === l} onClick={() => setLetter(l)}>{l.toUpperCase()}{l}</button>)}
          </div>
        </section>
      )}
      {mode === 'sounds' && (
        <section className="wx-card">
          <h2 className="wx-h2">Pick a sound</h2>
          <div className="wx-chips">{soundKeys.map((k) => <button key={k} type="button" className={`wx-chip${sound === k ? ' armed' : ''}`} aria-pressed={sound === k} onClick={() => setSound(k)}>{soundLabel(k)}</button>)}</div>
        </section>
      )}
      {mode === 'topics' && (
        <section className="wx-card">
          <h2 className="wx-h2">Pick a topic</h2>
          <div className="wx-topic-tiles">{TOPICS.map((t) => <button key={t} type="button" className={`wx-btn${topicPick === t ? ' wx-btn-primary' : ''}`} aria-pressed={topicPick === t} onClick={() => setTopicPick(t)}>{t}</button>)}</div>
        </section>
      )}

      <section className="wx-card">
        <div className="wx-filters">
          <Dropdown label="Part of speech" options={POS.map((p) => [p, p])} value={pos} onChange={setPos} />
          <Dropdown label="Tier" options={[['1', 'Tier 1'], ['2', 'Tier 2'], ['3', 'Tier 3']]} value={tier} onChange={setTier} />
          <Dropdown label="Frequency" options={[1, 2, 3, 4, 5].map((b) => [String(b), BAND_NAMES[b]])} value={band} onChange={setBand} />
          <Dropdown label="Topic" options={TOPICS.map((t) => [t, t])} value={topic} onChange={setTopic} />
          <Dropdown label="Word part" options={partOptions} value={part} onChange={setPart} />
          <button type="button" className={`wx-btn${picOnly ? ' wx-btn-primary' : ''}`} aria-pressed={picOnly} onClick={() => setPicOnly((v) => !v)}>Has a picture</button>
          <span style={{ flex: 1 }} />
          <div className="wx-seg" role="radiogroup" aria-label="Show as">
            <button type="button" role="radio" aria-checked={view === 'cards'} className={`wx-btn${view === 'cards' ? ' wx-btn-primary' : ''}`} onClick={() => onView('cards')}>Picture cards</button>
            <button type="button" role="radio" aria-checked={view === 'list'} className={`wx-btn${view === 'list' ? ' wx-btn-primary' : ''}`} onClick={() => onView('list')}>Plain list</button>
          </div>
        </div>
      </section>

      <section className="wx-card" aria-live="polite">
        {!ready ? <p role="status">Loading words...</p> : mode === 'sounds' && !sound ? <p>Pick a sound to see its words.</p> : mode === 'topics' && !topicPick ? <p>Pick a topic to see its words.</p> : (
          <>
            <p className="wx-lm-count">{results.length} {results.length === 1 ? 'word' : 'words'}</p>
            {mode === 'az' && shown.length > 0 && <p className="wx-guide" aria-label={`Guide words: ${shown[0].word} to ${shown[shown.length - 1].word}`}><span>{shown[0].word}</span><span>{shown[shown.length - 1].word}</span></p>}
            {view === 'cards'
              ? <ul className="wx-cards">{shown.map((w) => <li key={w.word}><WordCard w={w} pic={pics[w.word]?.file} /></li>)}</ul>
              : <ul className="wx-plain">{shown.map((w) => <li key={w.word}><TapWord word={w.word} /></li>)}</ul>}
            {pages > 1 && (
              <div className="wx-lm-actions">
                <button type="button" className="wx-btn" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Back</button>
                <span className="wx-fact">Page {page + 1} of {pages}</span>
                <button type="button" className="wx-btn" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
