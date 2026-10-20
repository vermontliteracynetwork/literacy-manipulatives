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

// Bubble text is always solid black or pure white, whichever contrasts more with the bubble's color
// (her request 2026-10-15: "solid dark black or pure white depending on the background color").
// Picked by WCAG contrast ratio, so light colors (yellow, pink, light blue) get black and dark ones get white.
const luminance = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
export const BUBBLE_BLACK = '#000000';
export const BUBBLE_WHITE = '#ffffff';
export function textOn(hex: string): string {
  const L = luminance(hex);
  return (L + 0.05) / 0.05 >= 1.05 / (L + 0.05) ? BUBBLE_BLACK : BUBBLE_WHITE;
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

// A random word placed in a sentence: capitalized when it starts the sentence, when it's a proper noun, and
// for the word I (her request 2026-10-15).
export function randomWordInSentence(cls: MontessoriWordClass, first: boolean): string {
  const w = randomWordFor(cls);
  if (first || cls === 'propernoun' || w.toLowerCase() === 'i') return w.charAt(0).toUpperCase() + w.slice(1);
  return w;
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
