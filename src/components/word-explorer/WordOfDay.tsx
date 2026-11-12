import { useEffect, useState, useSyncExternalStore } from 'react';
import { Icon } from '../Icon';
import { BAND_NAMES, PosTag, SpeakButton, Spoken, useReader } from './parts';
import { wordOfTheDay, sentenceFrame, type WordOfDay } from '../../lib/word-explorer/wotd';
import { onReview } from '../../lib/word-explorer/review';
import { clearEntryCache } from '../../lib/word-explorer/data';
import { addMyWord, myWords, removeMyWord, subscribeMyWords } from '../../lib/writer/myWords';
import type { WxSettings } from '../../lib/word-explorer/settings';

// The Word of the Day card on Home (build spec 4.1).
export function WordOfDayCard({ settings, onOpen }: { settings: WxSettings; onOpen: (w: string) => void }) {
  const [wotd, setWotd] = useState<WordOfDay | null>(null);
  const [v, setV] = useState(0);
  const [answer, setAnswer] = useState('');
  const { read } = useReader();
  useEffect(() => onReview(() => { clearEntryCache(); setV((x) => x + 1); }), []);
  useEffect(() => { let live = true; wordOfTheDay(settings).then((w) => { if (live) setWotd(w); }); return () => { live = false; }; },
    [settings.wotdFor, settings.wotdFrom, settings.wotdPattern, settings.wotdRepeatDays, v]);
  const word = wotd?.entry?.headword ?? '';
  const saved = useSyncExternalStore(subscribeMyWords, () => !!word && myWords().some((w) => w.word.toLowerCase() === word));
  if (!wotd) return null;
  const e = wotd.entry;
  if (!e) {
    if (!settings.teacherView) return null;
    return (
      <section className="wx-card wx-wotd">
        <h2 className="wx-h2">Word of the Day</h2>
        <p>{wotd.reason === 'none-approved'
          ? 'No words are approved yet. Open a word in Teacher view, approve its word facts and at least one meaning, and it can be the Word of the Day.'
          : 'No approved word fits the Word of the Day setting. Change it in Settings, or approve more words.'}</p>
      </section>
    );
  }
  const sense = e.senses.find((s) => s.definition.status === 'approved')!;
  const example = sense.examples.find((x) => x.status === 'approved');
  const picture = e.senses.find((s) => s.pictures.length)?.pictures[0];
  const frame = sentenceFrame(e.headword, sense.pos);
  const intro = `The Word of the Day is ${e.headword}.`;
  return (
    <section className="wx-card wx-wotd" aria-labelledby="wx-wotd-h">
      <h2 id="wx-wotd-h" className="wx-h2"><Icon name="sun" size={24} /> Word of the Day</h2>
      <div className="wx-wotd-top">
        {picture && <img className="wx-wotd-pic" src={picture.assetId} alt={e.headword} width={96} height={96} />}
        <div>
          <div className="wx-word-title">
            <span className="wx-wotd-word">{e.headword}</span>
            <SpeakButton id="wotd-word" text={`${intro} ${e.headword}.`} label={`Say ${e.headword}`} size="lg" />
            {e.soundOut && <span className="wx-soundout"><span className="wx-soundout-text">{e.soundOut}</span></span>}
          </div>
          <div className="wx-word-facts"><PosTag pos={sense.pos} /><span className="wx-fact">Tier {e.tier.value}</span><span className="wx-fact">{BAND_NAMES[e.frequencyBand.value]}</span></div>
        </div>
      </div>
      <dl className="wx-sense-body">
        <dt>Definition</dt><dd className="wx-definition"><Spoken id="wotd-def" text={sense.definition.value} /> <SpeakButton id="wotd-def" text={sense.definition.value} label="Read the definition" /></dd>
        {sense.explanation.value && sense.explanation.status === 'approved' && <><dt>Explanation</dt><dd><Spoken id="wotd-exp" text={sense.explanation.value} /> <SpeakButton id="wotd-exp" text={sense.explanation.value} label="Read the explanation" /></dd></>}
        {example && <><dt>Example</dt><dd className="wx-example-line"><Spoken id="wotd-ex" text={example.text} /> <SpeakButton id="wotd-ex" text={example.text} label="Read the example" />
          {example.time && <span className="wx-time">{example.time}</span>}{example.formulaCode && <span className="wx-code">Formula {example.formulaCode}</span>}</dd></>}
      </dl>
      <div className="wx-useit">
        <label htmlFor="wx-useit" className="wx-h3">Use it today</label>
        <p className="wx-useit-frame">{frame} <button type="button" data-nosay className="wx-speak" aria-label="Read the sentence frame" onClick={() => read('frame', frame.replace(/_+/g, 'blank'))}><Icon name="speaker" size={22} /></button></p>
        <input id="wx-useit" className="wx-input" value={answer} onChange={(ev) => setAnswer(ev.target.value)} placeholder="Finish the sentence" autoComplete="off" />
        {answer.trim() && <p className="wx-useit-done">{frame.replace(/_+/, answer.trim())} <button type="button" data-nosay className="wx-speak" aria-label="Read my sentence" onClick={() => read('mine', frame.replace(/_+/, answer.trim()))}><Icon name="speaker" size={22} /></button></p>}
      </div>
      <div className="wx-wotd-actions">
        <button type="button" className="wx-btn wx-btn-primary" onClick={() => onOpen(e.headword)}>Open word page</button>
        <button type="button" className={`wx-btn ${saved ? 'wx-btn-quiet' : 'wx-btn-secondary'}`} aria-pressed={saved} onClick={() => (saved ? removeMyWord(e.headword) : addMyWord(e.headword, sense.pos))}>
          <Icon name={saved ? 'starFilled' : 'star'} size={22} /><span>{saved ? 'Saved to My Words' : 'Save to My Words'}</span>
        </button>
      </div>
    </section>
  );
}
