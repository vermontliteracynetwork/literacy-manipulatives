import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Icon } from '../Icon';
import { BAND_NAMES, PosTag, SpeakButton, Spoken, StatusTag, TapWord, wordCount } from './parts';
import { clearEntryCache, getEntry } from '../../lib/word-explorer/data';
import { onReview } from '../../lib/word-explorer/review';
import { ReviewButtons } from './ReviewButtons';
import { PicturesTab, SoundsTab, WordPartsTab } from './StudyTabs';
import { baseWords } from '../../lib/word-explorer/search';
import { readSentenceWhy, onWordTypes, type WordType } from '../../lib/wordTypes';
import { addMyWord, myWords, removeMyWord, subscribeMyWords } from '../../lib/writer/myWords';
import { visibleTo, type Example, type PartOfSpeech, type Provenance, type Sense, type WordEntry } from '../../lib/word-explorer/types';

type Tab = 'dictionary' | 'sounds' | 'parts' | 'pictures';
const TABS: { id: Tab; label: string; icon: 'book' | 'speaker' | 'puzzle' | 'image' }[] = [
  { id: 'dictionary', label: 'Dictionary', icon: 'book' },
  { id: 'sounds', label: 'Sounds', icon: 'speaker' },
  { id: 'parts', label: 'Word Parts', icon: 'puzzle' },
  { id: 'pictures', label: 'Pictures', icon: 'image' },
];

export function WordPage({ word, teacher, note }: { word: string; teacher: boolean; note?: string }) {
  const [entry, setEntry] = useState<WordEntry | null | undefined>(undefined);
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState<Tab>('dictionary');
  useEffect(() => onReview(() => { clearEntryCache(); setVersion((v) => v + 1); }), []);
  useEffect(() => onWordTypes(() => setVersion((v) => v + 1)), []);
  useEffect(() => {
    let live = true;
    setEntry(undefined);
    getEntry(word).then((e) => { if (live) setEntry(e); });
    return () => { live = false; };
  }, [word, version]);

  if (entry === undefined) return <p className="wx-loading" role="status">Finding {word}...</p>;
  if (entry === null) return <p className="wx-empty">Word Explorer does not have the word "{word}".</p>;

  return (
    <article className="wx-word" aria-labelledby="wx-headword">
      <WordHeader entry={entry} teacher={teacher} />
      {note && <p className="wx-note" role="status"><Spoken id="note" text={note} /> <SpeakButton id="note" text={note} label="Read this note" /></p>}
      <div className="wx-word-body">
        <nav className="wx-sidemenu" aria-label="Word page sections">
          <div role="tablist" aria-orientation="vertical">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" id={`wx-tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`wx-panel-${t.id}`} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
                <Icon name={t.icon} size={24} /><span>{t.label}</span>
              </button>
            ))}
          </div>
        </nav>
        <div role="tabpanel" id={`wx-panel-${tab}`} aria-labelledby={`wx-tab-${tab}`} className="wx-panel">
          {tab === 'dictionary' && <DictionaryTab entry={entry} teacher={teacher} />}
          {tab === 'sounds' && <SoundsTab entry={entry} teacher={teacher} />}
          {tab === 'parts' && <WordPartsTab entry={entry} teacher={teacher} />}
          {tab === 'pictures' && <PicturesTab entry={entry} teacher={teacher} />}
        </div>
      </div>
    </article>
  );
}

function WordHeader({ entry, teacher }: { entry: WordEntry; teacher: boolean }) {
  const saved = useSyncExternalStore(subscribeMyWords, () => myWords().some((w) => w.word.toLowerCase() === entry.headword));
  const showFacts = visibleTo(entry.status, teacher);
  const main = entry.partsOfSpeech[0];
  return (
    <header className="wx-word-head">
      <div className="wx-word-title">
        <h1 id="wx-headword" className="wx-headword">{entry.headword}</h1>
        <SpeakButton id="headword" text={entry.headword} label={`Say ${entry.headword}`} size="lg" />
        {showFacts && entry.soundOut && (
          <span className="wx-soundout">
            <span className="wx-soundout-text">{entry.soundOut}</span>
            <SpeakButton id="soundout" text={entry.headword} rate={0.55} label={`Say ${entry.headword} slowly`} />
          </span>
        )}
      </div>
      <div className="wx-word-facts">
        {entry.partsOfSpeech.length > 0 && (
          <ul className="wx-pos-list" aria-label="Parts of speech">
            {entry.partsOfSpeech.slice(0, 4).map((p) => <li key={p}><PosTag pos={p} /></li>)}
          </ul>
        )}
        {showFacts && <span className="wx-fact">Tier {entry.tier.value}</span>}
        {showFacts && <span className="wx-fact">{BAND_NAMES[entry.frequencyBand.value]}</span>}
        {teacher && <StatusTag status={entry.status} />}
        <button type="button" className={`wx-btn ${saved ? 'wx-btn-quiet' : 'wx-btn-secondary'}`} aria-pressed={saved}
          onClick={() => (saved ? removeMyWord(entry.headword) : addMyWord(entry.headword, main ?? 'noun'))}>
          <Icon name={saved ? 'starFilled' : 'star'} size={22} /><span>{saved ? 'Saved to My Words' : 'Save to My Words'}</span>
        </button>
      </div>
      {teacher && <ReviewButtons statusKey={`${entry.id}:entry`} status={entry.status} what="the word facts (forms, Tier, frequency, sound-out)" />}
    </header>
  );
}

function DictionaryTab({ entry, teacher }: { entry: WordEntry; teacher: boolean }) {
  const senses = entry.senses.filter((s) => visibleTo(s.definition.status, teacher));
  const showFacts = visibleTo(entry.status, teacher);
  const synonyms = uniq(senses.flatMap((s) => s.synonyms.map((x) => x.wordId))).slice(0, 10);
  const antonyms = uniq(senses.flatMap((s) => s.antonyms.map((x) => x.wordId))).slice(0, 8);
  const picture = senses.find((s) => s.pictures.length)?.pictures[0];
  const family = uniqBy(senses.flatMap((s) => s.family), (f) => f.wordId).slice(0, 10);
  const sources = uniqBy([...entry.senses.flatMap((s) => [...s.definition.provenance, ...s.explanation.provenance]), ...entry.forms.provenance, ...entry.frequencyBand.provenance, ...entry.tier.provenance], (p) => p.source);

  return (
    <div className="wx-dict">
      <div className="wx-senses">
        <h2 className="wx-h2">Meanings</h2>
        {senses.length === 0 && (
          <p className="wx-waiting"><Spoken id="waiting" text="This word is waiting for a teacher to check it. Ask your teacher about it." /> <SpeakButton id="waiting" text="This word is waiting for a teacher to check it. Ask your teacher about it." label="Read this message" /></p>
        )}
        {senses.map((s, i) => <SenseCard key={s.id} entry={entry} sense={s} n={i + 1} teacher={teacher} />)}
      </div>
      <aside className="wx-side" aria-label="More about this word">
        {picture && (
          <figure className="wx-side-card wx-side-picture">
            <img src={picture.assetId} alt={entry.headword} width={120} height={120} />
          </figure>
        )}
        {showFacts && <Forms entry={entry} />}
        {family.length > 0 && (
          <section className="wx-side-card">
            <h2 className="wx-h3">Word family</h2>
            <div className="wx-chips">{family.map((f) => <TapWord key={f.wordId} word={f.wordId} pos={f.pos} />)}</div>
          </section>
        )}
        {synonyms.length > 0 && (
          <section className="wx-side-card">
            <h2 className="wx-h3">Words that mean almost the same</h2>
            <div className="wx-chips">{synonyms.map((w) => <TapWord key={w} word={w} />)}</div>
          </section>
        )}
        {antonyms.length > 0 && (
          <section className="wx-side-card">
            <h2 className="wx-h3">Opposites</h2>
            <div className="wx-chips">{antonyms.map((w) => <TapWord key={w} word={w} />)}</div>
          </section>
        )}
        <section className="wx-side-card wx-sources">
          <h2 className="wx-h3">Sources</h2>
          <ul>{sources.map((p) => <li key={p.source}><SourceLine p={p} /></li>)}</ul>
        </section>
      </aside>
    </div>
  );
}

function SourceLine({ p }: { p: Provenance }) {
  return <>{p.url ? <a href={p.url} target="_blank" rel="noreferrer">{p.source}</a> : p.source} ({p.license})</>;
}

function Forms({ entry }: { entry: WordEntry }) {
  const f = entry.forms.value;
  const rows: [string, string[]][] = [];
  if (f.past) rows.push(['Past', [f.past]]);
  if (f.present) rows.push(['Present', f.present]);
  if (f.future) rows.push(['Future', [f.future]]);
  if (f.ing) rows.push(['With -ing', [f.ing]]);
  if (f.plural) rows.push(['More than one', [f.plural]]);
  if (f.comparative) rows.push(['Comparing two', [f.comparative]]);
  if (f.superlative) rows.push(['Comparing three or more', [f.superlative]]);
  if (!rows.length) return null;
  return (
    <section className="wx-side-card">
      <h2 className="wx-h3">Forms</h2>
      <dl className="wx-forms">
        {rows.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v.map((w) => <TapWord key={w} word={w} />)}</dd></div>
        ))}
      </dl>
    </section>
  );
}

const WT_POS: Partial<Record<WordType, PartOfSpeech>> = { propernoun: 'noun' };
// The "why" line: where the headword sits in the example, and what the word type engine says about it.
function whyLine(example: string, entry: WordEntry, pos: PartOfSpeech): string | null {
  const words = example.split(/\s+/).filter(Boolean);
  const bare = words.map((w) => w.toLowerCase().replace(/^[^a-z']+|[^a-z']+$/g, ''));
  const formsOf = new Set([entry.headword, ...Object.values(entry.forms.value).flat().filter((x): x is string => typeof x === 'string')]);
  const at = bare.findIndex((w) => formsOf.has(w) || baseWords(w).includes(entry.headword));
  if (at < 0) return null;
  const r = readSentenceWhy(words)[at];
  if (!r) return null;
  const got = WT_POS[r.type] ?? (r.type as PartOfSpeech);
  // Only show it when the engine agrees with this meaning's part of speech; otherwise it would confuse.
  return got === pos ? r.why : null;
}

function SenseCard({ entry, sense, n, teacher }: { entry: WordEntry; sense: Sense; n: number; teacher: boolean }) {
  const id = `sense:${sense.id}`;
  const heading = `${entry.headword} (${sense.signpost})`;
  const def = sense.definition.value;
  const exp = visibleTo(sense.explanation.status, teacher) ? sense.explanation.value : '';
  const readText = [heading, `${sense.pos}.`, def, exp].filter(Boolean).join(' ');
  const examples = sense.examples.filter((e) => visibleTo(e.status, teacher));
  const offDef = wordCount(heading) + 1;
  const offExp = offDef + wordCount(def);
  return (
    <section className="wx-sense" aria-labelledby={`${id}-h`}>
      <div className="wx-sense-head">
        <h3 id={`${id}-h`} className="wx-sense-title"><span className="wx-sense-n">{n}.</span> <Spoken id={id} text={heading} /></h3>
        <PosTag pos={sense.pos} />
        <SpeakButton id={id} text={readText} label={`Read meaning ${n}`} />
        {teacher && <StatusTag status={sense.definition.status} />}
      </div>
      <dl className="wx-sense-body">
        <dt>Definition</dt>
        <dd className="wx-definition"><Spoken id={id} text={def} offset={offDef} /></dd>
        {exp ? <><dt>Explanation</dt><dd className="wx-explanation"><Spoken id={id} text={exp} offset={offExp} /></dd></>
          : teacher && <><dt>Explanation</dt><dd className="wx-missing">Not written yet.</dd></>}
      </dl>
      {examples.length > 0 && (
        <div className="wx-examples">
          <h4 className="wx-h4">Examples</h4>
          <ul>{examples.map((e, i) => <ExampleRow key={i} e={e} id={`${id}:ex${i}`} entry={entry} pos={sense.pos} teacher={teacher} />)}</ul>
        </div>
      )}
      {sense.grammar.patterns.length > 0 && (
        <div className="wx-patterns">
          <h4 className="wx-h4">How to use it</h4>
          <ul className="wx-chips">{sense.grammar.patterns.map((p) => <li key={p} className="wx-pattern">{p}</li>)}</ul>
        </div>
      )}
      {teacher && (
        <div className="wx-teacher-row">
          <p className="wx-source-line">Source: {uniqBy([...sense.definition.provenance, ...sense.explanation.provenance], (p) => p.source).map((p) => `${p.source} (${p.license})`).join('; ')}</p>
          <ReviewButtons statusKey={`${sense.id}:sense`} status={sense.definition.status} what={`meaning ${n}`} />
        </div>
      )}
    </section>
  );
}

function ExampleRow({ e, id, entry, pos, teacher }: { e: Example; id: string; entry: WordEntry; pos: PartOfSpeech; teacher: boolean }) {
  const why = useMemo(() => whyLine(e.text, entry, pos), [e.text, entry, pos]);
  return (
    <li className="wx-example">
      <div className="wx-example-line">
        <SpeakButton id={id} text={e.text} label="Read this example" />
        <span className="wx-example-text"><Spoken id={id} text={e.text} /></span>
        {e.time && <span className={`wx-time wx-time-${e.time}`}>{e.time}</span>}
        {e.formulaCode ? <span className="wx-code">Formula {e.formulaCode}</span> : teacher && <span className="wx-code">No formula card matches</span>}
      </div>
      {why && (
        <p className="wx-why">
          <span className="wx-why-label">Why:</span> <Spoken id={`${id}:why`} text={why} />
          <SpeakButton id={`${id}:why`} text={why} label="Read why" />
        </p>
      )}
    </li>
  );
}

function uniq<T>(xs: T[]) { return [...new Set(xs)]; }
function uniqBy<T>(xs: T[], k: (x: T) => string) { const seen = new Set<string>(); return xs.filter((x) => (seen.has(k(x)) ? false : (seen.add(k(x)), true))); }
