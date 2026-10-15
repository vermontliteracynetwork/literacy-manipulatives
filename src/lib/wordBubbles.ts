// Word bubbles (her request 2026-10-15, with a picture of "He tied his skates in his stinky locker room ."):
// "i want the text bubble to be attatched to the icon itself. solid and outline options should be available.
// always have punctiuation as a separete icon. should be able to type words in bubbles, even replacing
// default/random words". Shared helpers for the bubble under every Grammar Symbol and Symbol Sentence word.

import { ADJECTIVES, ADVERBS, ARTICLES, COMMON_NOUNS, CONJUNCTIONS, INTERJECTIONS, OBJECT_PRONOUNS, PREPOSITIONS, PROPER_NOUNS, SUBJECT_PRONOUNS, type MontessoriWordClass } from './montessoriGrammar';
import { SANDBOX_VERBS } from './grammarContent';
import type { SymbolSentence } from './symbolSentences';

export type BubbleStyle = 'outline' | 'solid';

// Punctuation always lives in its own gray icon, never inside a word bubble, so typed marks are left out.
export const stripPunctuation = (t: string) => t.replace(/[.,!?;:"]/g, '');

// The marks a punctuation icon steps through when tapped.
export const PUNCT_CYCLE = ['.', '?', '!', ','];
export const nextPunct = (m: string) => PUNCT_CYCLE[(PUNCT_CYCLE.indexOf(m) + 1) % PUNCT_CYCLE.length];

// Dark text on light symbol colors (yellow, pink, light blue), white text on the dark ones.
export function textOn(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#1f1147' : '#ffffff';
}

const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];

export function randomWordFor(cls: MontessoriWordClass): string {
  if (cls === 'noun') return pick(COMMON_NOUNS).text;
  if (cls === 'propernoun') return pick(PROPER_NOUNS).text;
  if (cls === 'pronoun') return pick([...SUBJECT_PRONOUNS, ...OBJECT_PRONOUNS]).text;
  if (cls === 'article') return pick(ARTICLES).text;
  if (cls === 'adjective') return pick(ADJECTIVES).text;
  if (cls === 'adverb') return pick(ADVERBS).text;
  if (cls === 'preposition') return pick(PREPOSITIONS).text;
  if (cls === 'conjunction') return pick(CONJUNCTIONS).text;
  if (cls === 'interjection') return stripPunctuation(pick(INTERJECTIONS).text);
  return pick(SANDBOX_VERBS).text;
}

// A Symbol Sentence as icons in order: one per word, plus a separate punctuation icon wherever the real
// sentence has a mark (the comma after "Softly", the period at the end). Every sentence ends with one.
export type SentenceToken = { type: 'word'; index: number } | { type: 'punct'; slot: number; mark: string };

export function sentenceTokens(s: SymbolSentence): SentenceToken[] {
  const out: SentenceToken[] = [];
  const text = s.sentence;
  let pos = 0;
  s.words.forEach((w, i) => {
    out.push({ type: 'word', index: i });
    let at = text.indexOf(w.word, pos);
    if (at < 0) at = text.toLowerCase().indexOf(w.word.toLowerCase(), pos);
    if (at < 0) return;
    pos = at + w.word.length;
    const m = /^\s*([.,!?;:])/.exec(text.slice(pos));
    if (m) { out.push({ type: 'punct', slot: i, mark: m[1] }); pos += m[0].length; }
  });
  if (out[out.length - 1]?.type !== 'punct') out.push({ type: 'punct', slot: s.words.length - 1, mark: '.' });
  return out;
}
