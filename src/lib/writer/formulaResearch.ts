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
// u: word groups the review found that name one thing (cricket bat), each [first, last] word index (her D-28).
export interface ResearchSentence { t: string; b: number; s: string; c: string[]; u?: [number, number][] }
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

// Words that work together take one part of speech, with one symbol floating over them (her rule 2026-11-20: "such
// as, as well as, all the, than should be one part of speech if they work together ... same as like a verb, like will
// run"). The symbol for each group: her prepositions list's word groups are prepositions.
const GROUPS: [string[], SymbolWordClass][] = [
  [['as', 'well', 'as'], 'conjunction'], [['such', 'as'], 'preposition'], [['in', 'spite', 'of'], 'preposition'], [['on', 'account', 'of'], 'preposition'],
  [['according', 'to'], 'preposition'], [['because', 'of'], 'preposition'], [['instead', 'of'], 'preposition'], [['out', 'of'], 'preposition'],
  [['rather', 'than'], 'conjunction'], [['other', 'than'], 'conjunction'], [['more', 'than'], 'adjective'], [['less', 'than'], 'adjective'],
  [['fewer', 'than'], 'adjective'], [['all', 'the'], 'adjective'],
];
// Groups whose symbol changes the formula code too (the rest only share one symbol in the Formula column).
const CODE_GROUPS = new Set<SymbolWordClass>(['preposition', 'conjunction']);
const HELPING = new Set(['am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'will', 'would', 'can', 'could', 'may', 'might', 'must', 'shall', 'should', 'do', 'does', 'did', 'have', 'has', 'had']);

interface Group { from: number; to: number; cls: string }
/** The word groups in a sentence that share one symbol: a helping verb and its verb (will run), a name of more than
 *  one word (Betsy Ross), a hyphenated word, a naming word of two words (cricket bat), and her word groups (such as). */
export function wordGroups(words: TaggedWord[], raw: string, units: [number, number][] = []): Group[] {
  const text = numbersAsWords(raw);
  const spans = [...text.matchAll(/[A-Za-z']+/g)].map((m) => ({ at: m.index ?? 0, end: (m.index ?? 0) + m[0].length }));
  const gap = (i: number) => text.slice(spans[i].end, spans[i + 1]?.at ?? spans[i].end);
  const joined = (i: number) => /^\s*$/.test(gap(i)) || /^-$/.test(gap(i));
  const cls = (i: number) => (words[i]?.parts?.length ? 'x' : words[i]?.wordClass ?? 'x');
  const lower = words.map((w) => w.word.toLowerCase());
  const taken = new Array(words.length).fill(false);
  const out: Group[] = [];
  const add = (from: number, to: number, c: string) => { if (to <= from) return; for (let k = from; k <= to; k++) if (taken[k]) return; for (let k = from; k <= to; k++) taken[k] = true; out.push({ from, to, cls: c }); };
  for (const [a, b] of units) add(a, b, 'noun');
  for (let i = 0; i < words.length; i++) {
    for (const [g, c] of GROUPS) if (g.every((w, k) => lower[i + k] === w && (k === g.length - 1 || joined(i + k)))) { add(i, i + g.length - 1, c); break; }
  }
  for (let i = 0; i < words.length; i++) {
    let j = i;
    if (/^-$/.test(gap(i))) { while (j + 1 < words.length && /^-$/.test(gap(j))) j++; add(i, j, cls(j)); i = j; continue; }
    if (cls(i) === 'propernoun') { while (j + 1 < words.length && cls(j + 1) === 'propernoun' && /^\s*$/.test(gap(j))) j++; add(i, j, 'propernoun'); i = j; continue; }
    if (cls(i) === 'verb' && HELPING.has(lower[i])) { while (j + 1 < words.length && cls(j + 1) === 'verb' && /^\s*$/.test(gap(j))) j++; add(i, j, 'verb'); i = j; }
  }
  return out.sort((x, y) => x.from - y.from);
}

/** Every word's part of speech in order, with the commas, semicolons, colons and apostrophes the sentence has
 *  (her rule 2026-11-20), and one symbol for words that work together: "pronoun + verb + , + pronoun'verb + noun's". */
export function wordByWord(words: TaggedWord[], raw: string, units: [number, number][] = []): string {
  const text = numbersAsWords(raw);
  const groups = wordGroups(words, raw, units);
  const out: string[] = [];
  let last = 0, i = 0;
  for (const m of text.matchAll(/[A-Za-z']+/g)) {
    const at = m.index ?? 0;
    for (const p of text.slice(last, at).match(/[,;:]/g) ?? []) out.push(p);
    const k = i++;
    const w = words[k];
    const g = groups.find((x) => k >= x.from && k <= x.to);
    if (g && k > g.from) { last = at + m[0].length; continue; }
    if (g) out.push(label(g.cls));
    else if (w) {
      const word = m[0];
      if (w.parts?.length) out.push(w.parts.map(label).join("'"));
      else out.push(label(w.wordClass) + (/'s$|s'$/i.test(word) ? (word.endsWith("'") ? "'" : "'s") : ''));
    }
    last = at + m[0].length;
  }
  for (const p of text.slice(last).match(/[,;:]/g) ?? []) out.push(p);
  return out.join(' + ');
}

export interface Read { code: string; her?: Listed; formula: string }
/** A sentence's formula code (her notation), whether it is in her list, and its word-by-word formula. */
export function readResearch(text: string, classes?: string[], units?: [number, number][]): Read | null {
  let words = wordsOf(text, classes);
  if (!words.length) return null;
  const t = numbersAsWords(text);
  // Her word groups that are prepositions or joining words count as one in the formula code too (such as, as well as).
  for (const g of wordGroups(words, text, units)) if (CODE_GROUPS.has(g.cls as SymbolWordClass)) words = words.map((w, k) => (k >= g.from && k <= g.to ? { ...w, wordClass: g.cls as SymbolWordClass, parts: undefined } : w));
  const code = formulaCode(sentenceSlots(words, t), t);
  const her = listedFormulas().find((f) => bare(f.code) === code);
  return { code, her, formula: wordByWord(words, text, units) };
}

let herFormula: Map<string, string> | null = null;
/** Her example's word-by-word formula, for a formula in her list. */
export function herWordByWord(f: Listed): string {
  herFormula ??= new Map();
  const key = f.example;
  if (!herFormula.has(key)) { const t = f.example.replace(/[“”]/g, '"'); herFormula.set(key, wordByWord(tagForCheck(numbersAsWords(t)), t)); }
  return herFormula.get(key)!;
}
