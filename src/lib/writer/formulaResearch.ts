import type { SymbolWordClass } from '../grammarSymbols';
import { formulaCode, sentenceSlots } from './formulaMatch';
import { listedFormulas, type Listed } from './formulaLookup';
import { tagForCheck } from './sentenceCheck';
import type { TaggedWord } from './tagger';

// Formula research (Formula Search's Log Formulas tab, her requests 2026-11-20). "This is merely for research and not
// for actual curriculum development." The reading passages (text only) are in public/formula-research/sentences.json:
// every complete sentence, with every word's symbol reviewed by hand against her conventions ("make sure formulas are
// actually correct, otherwise this research is useless"). The formula code is worked out from those symbols by the
// grammar engine, so it is always written her way.

export interface ResearchBook { id: string; name: string; grade: string; publisher: string }
// t: the sentence; b: its book (index into books); s: where in the book; c: each word's symbol (a contraction's two
// symbols joined by an apostrophe), reviewed.
export interface ResearchSentence { t: string; b: number; s: string; c: string[] }
export interface Research { books: ResearchBook[]; sentences: ResearchSentence[]; left: number; reviewed: string }

let loading: Promise<Research | null> | null = null;
export function loadResearch(): Promise<Research | null> {
  loading ??= fetch('/formula-research/sentences.json').then((r) => (r.ok ? r.json() : null)).catch(() => { loading = null; return null; });
  return loading;
}

const bare = (c: string) => c.replace(/\*$/, '');
const NAME: Partial<Record<string, string>> = { propernoun: 'proper noun' };
const label = (c: string) => NAME[c] ?? c;

/** The engine reads letters only, so a number written in digits (365, 1776, 4.5, 1800s) is read as a number word. */
export const numbersAsWords = (text: string) => text.replace(/\d+(?:,\d{3})*(?:\.\d+)?(s\b)?/g, (_, s?: string) => (s ? 'nines' : 'nine'));

/** The sentence's words with their symbols: the reviewed ones when given, otherwise the engine's reading. */
export function wordsOf(text: string, classes?: string[]): TaggedWord[] {
  const words = tagForCheck(numbersAsWords(text));
  if (!classes || classes.length !== words.length) return words;
  return words.map((w, i) => {
    const parts = classes[i].split("'") as SymbolWordClass[];
    return parts.length > 1 ? { ...w, wordClass: parts[0], parts } : { ...w, wordClass: parts[0], parts: undefined };
  });
}

/** Every word's part of speech in order, with the commas, semicolons, colons and apostrophes the sentence has
 *  (her rule 2026-11-20): "pronoun + verb + , + conjunction + pronoun'verb + noun's". */
export function wordByWord(words: TaggedWord[], raw: string): string {
  const text = numbersAsWords(raw);
  const out: string[] = [];
  let last = 0, i = 0;
  for (const m of text.matchAll(/[A-Za-z']+/g)) {
    const at = m.index ?? 0;
    for (const p of text.slice(last, at).match(/[,;:]/g) ?? []) out.push(p);
    const w = words[i++];
    if (w) {
      const raw = m[0];
      if (w.parts?.length) out.push(w.parts.map(label).join("'"));
      else out.push(label(w.wordClass) + (/'s$|s'$/i.test(raw) ? (raw.endsWith("'") ? "'" : "'s") : ''));
    }
    last = at + m[0].length;
  }
  for (const p of text.slice(last).match(/[,;:]/g) ?? []) out.push(p);
  return out.join(' + ');
}

export interface Read { code: string; her?: Listed; formula: string }
/** A sentence's formula code (her notation), whether it is in her list, and its word-by-word formula. */
export function readResearch(text: string, classes?: string[]): Read | null {
  const words = wordsOf(text, classes);
  if (!words.length) return null;
  const t = numbersAsWords(text);
  const code = formulaCode(sentenceSlots(words, t), t);
  const her = listedFormulas().find((f) => bare(f.code) === code);
  return { code, her, formula: wordByWord(words, text) };
}

let herFormula: Map<string, string> | null = null;
/** Her example's word-by-word formula, for a formula in her list. */
export function herWordByWord(f: Listed): string {
  herFormula ??= new Map();
  const key = f.example;
  if (!herFormula.has(key)) { const t = f.example.replace(/[“”]/g, '"'); herFormula.set(key, wordByWord(tagForCheck(numbersAsWords(t)), t)); }
  return herFormula.get(key)!;
}
