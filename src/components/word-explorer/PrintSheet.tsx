import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { allPictures } from '../../lib/word-explorer/pictures';
import { getEntry } from '../../lib/word-explorer/data';
import { mainPos } from '../../lib/word-explorer/morphology';
import { PATTERN_BY_ID, patternLabel, phonicsOf } from '../../lib/word-explorer/phonics';
import { GRAMMAR_SYMBOL_INFO } from '../../lib/grammarSymbols';

// Printables from a word list (build spec section 6 outputs, section 9 large print and high contrast versions).
export type PrintKind = 'wall' | 'flash' | 'frayer' | 'sort' | 'spelling';
const TITLES: Record<PrintKind, string> = { wall: 'Word wall cards', flash: 'Flash cards', frayer: 'Frayer cards', sort: 'Two-column sort', spelling: 'Spelling list' };

interface Card { word: string; pic?: string; pos?: string; def?: string; patterns: string[] }

export function PrintSheet({ kind, large, contrast, title, words, groups, onDone }: { kind: PrintKind; large: boolean; contrast: boolean; title: string; words: string[]; groups: string[]; onDone: () => void }) {
  const [cards, setCards] = useState<Card[] | null>(null);
  useEffect(() => {
    let live = true;
    const list = words.slice(0, kind === 'frayer' ? 30 : 200);
    (async () => {
      const pics = await allPictures();
      const out: Card[] = [];
      for (const w of list) {
        const card: Card = { word: w, pic: pics[w]?.file, pos: mainPos(w), patterns: [] };
        if (kind === 'frayer') {
          // Only an approved meaning is printed; otherwise the box is left to fill in.
          const e = await getEntry(w);
          card.def = e?.senses.find((s) => s.definition.status === 'approved')?.definition.value;
        }
        if (kind === 'sort') card.patterns = (await phonicsOf(w))?.graphemes.map((g) => g.patternId) ?? [];
        out.push(card);
      }
      if (live) setCards(out);
    })();
    return () => { live = false; };
  }, [kind, words]);
  useEffect(() => {
    if (!cards) return;
    const done = () => onDone();
    window.addEventListener('afterprint', done, { once: true });
    const t = window.setTimeout(() => window.print(), 300);
    return () => { window.clearTimeout(t); window.removeEventListener('afterprint', done); };
  }, [cards, onDone]);

  const symbol = (pos?: string) => (pos && pos in GRAMMAR_SYMBOL_INFO ? <img className="wxp-sym" src={GRAMMAR_SYMBOL_INFO[pos as keyof typeof GRAMMAR_SYMBOL_INFO].imageUrl} alt="" /> : null);
  const body = !cards ? <p>Getting the cards ready...</p> : kind === 'spelling' ? (
    <ol className="wxp-spelling">{cards.map((c) => <li key={c.word}>{c.word}</li>)}</ol>
  ) : kind === 'sort' ? (
    <div className="wxp-sort">
      {[0, 1].map((i) => {
        const g = groups[i];
        const p = g ? PATTERN_BY_ID.get(g) : undefined;
        return <div key={i} className="wxp-col"><h2>{p ? patternLabel(p) : '________'}</h2></div>;
      })}
      <div className="wxp-cut">{cards.map((c) => <span key={c.word} className="wxp-cutword">{c.word}</span>)}</div>
    </div>
  ) : kind === 'frayer' ? (
    <div className="wxp-frayers">{cards.map((c) => (
      <div key={c.word} className="wxp-frayer">
        <div className="wxp-box"><strong>Definition</strong><p>{c.def ?? ''}</p></div>
        <div className="wxp-box"><strong>Facts or picture</strong>{c.pic && <img src={c.pic} alt="" />}</div>
        <div className="wxp-center">{symbol(c.pos)}{c.word}</div>
        <div className="wxp-box"><strong>Examples</strong></div>
        <div className="wxp-box"><strong>Non-examples</strong></div>
      </div>
    ))}</div>
  ) : (
    <div className={`wxp-cards wxp-${kind}`}>{cards.map((c) => (
      <div key={c.word} className="wxp-card">
        {c.pic && <img src={c.pic} alt="" />}
        <span className="wxp-word">{symbol(c.pos)}{c.word}</span>
      </div>
    ))}</div>
  );
  return createPortal(
    <div className={`wxp${large ? ' wxp-large' : ''}${contrast ? ' wxp-contrast' : ''}`} aria-hidden="true">
      <h1>{title}: {TITLES[kind]}</h1>
      {body}
    </div>,
    document.body,
  );
}
