import type { PartOfSpeech, Provenance } from './types';
import { indexWord, rawWord } from './data';
import { baseWords } from './search';
import { ALL_MORPHEMES } from '../morphemes';
import { isBlockedTerm } from './safety';

// Word parts for the Word Parts tab (build spec 4.2): word sums ("un + happy -> unhappy"), the word matrix of a
// family, how a suffix changes the part of speech, and the Greek and Latin root of the week. UI-free.
// Prefix, suffix and root meanings come from the board's morpheme pieces (src/lib/morphemes.ts, her decks).

export interface Affix { text: string; kind: 'prefix' | 'suffix'; meaning: string; from?: PartOfSpeech[]; to?: PartOfSpeech; inflection?: boolean }

export const SUFFIXES: Affix[] = [
  { text: 's', kind: 'suffix', meaning: 'more than one; or he, she or it does it', inflection: true },
  { text: 'es', kind: 'suffix', meaning: 'more than one; or he, she or it does it', inflection: true },
  { text: 'ed', kind: 'suffix', meaning: 'past', inflection: true },
  { text: 'ing', kind: 'suffix', meaning: 'doing it now', inflection: true },
  { text: 'er', kind: 'suffix', meaning: 'more (comparing two)', inflection: true, from: ['adjective'], to: 'adjective' },
  { text: 'est', kind: 'suffix', meaning: 'most (comparing three or more)', inflection: true, from: ['adjective'], to: 'adjective' },
  { text: 'er', kind: 'suffix', meaning: 'a person or thing that does it', from: ['verb'], to: 'noun' },
  { text: 'or', kind: 'suffix', meaning: 'a person or thing that does it', from: ['verb'], to: 'noun' },
  { text: 'ist', kind: 'suffix', meaning: 'a person who does or studies it', from: ['noun'], to: 'noun' },
  { text: 'ly', kind: 'suffix', meaning: 'in this way', from: ['adjective'], to: 'adverb' },
  { text: 'ness', kind: 'suffix', meaning: 'being this way', from: ['adjective'], to: 'noun' },
  { text: 'ful', kind: 'suffix', meaning: 'full of', from: ['noun', 'verb'], to: 'adjective' },
  { text: 'less', kind: 'suffix', meaning: 'without', from: ['noun', 'verb'], to: 'adjective' },
  { text: 'ment', kind: 'suffix', meaning: 'the act or result of', from: ['verb'], to: 'noun' },
  { text: 'able', kind: 'suffix', meaning: 'can be done', from: ['verb'], to: 'adjective' },
  { text: 'ible', kind: 'suffix', meaning: 'can be done', from: ['verb'], to: 'adjective' },
  { text: 'ation', kind: 'suffix', meaning: 'the act or result of', from: ['verb'], to: 'noun' },
  { text: 'tion', kind: 'suffix', meaning: 'the act or result of', from: ['verb'], to: 'noun' },
  { text: 'ion', kind: 'suffix', meaning: 'the act or result of', from: ['verb'], to: 'noun' },
  { text: 'ive', kind: 'suffix', meaning: 'tends to do', from: ['verb'], to: 'adjective' },
  { text: 'ous', kind: 'suffix', meaning: 'full of', from: ['noun'], to: 'adjective' },
  { text: 'y', kind: 'suffix', meaning: 'full of or like', from: ['noun'], to: 'adjective' },
  { text: 'ish', kind: 'suffix', meaning: 'a little, or like', from: ['noun', 'adjective'], to: 'adjective' },
  { text: 'hood', kind: 'suffix', meaning: 'the state or group of', from: ['noun'], to: 'noun' },
  { text: 'ship', kind: 'suffix', meaning: 'the state or skill of', from: ['noun'], to: 'noun' },
  { text: 'al', kind: 'suffix', meaning: 'about or like', from: ['noun'], to: 'adjective' },
  { text: 'ity', kind: 'suffix', meaning: 'being this way', from: ['adjective'], to: 'noun' },
  { text: 'en', kind: 'suffix', meaning: 'to make', from: ['adjective'], to: 'verb' },
  { text: 'ize', kind: 'suffix', meaning: 'to make', from: ['noun', 'adjective'], to: 'verb' },
];
const meaningOf = (text: string, kind: 'prefix' | 'suffix', fallback: string) =>
  ALL_MORPHEMES.find((m) => m.kind === kind && m.text === text)?.meaning ?? fallback;
export const PREFIXES: Affix[] = [
  ['un', 'not'], ['re', 'again'], ['dis', 'not, or the opposite of'], ['pre', 'before'], ['mis', 'wrongly'], ['non', 'not'],
  ['in', 'not'], ['im', 'not'], ['il', 'not'], ['ir', 'not'], ['over', 'too much'], ['under', 'too little, or below'],
  ['sub', 'under'], ['inter', 'between'], ['super', 'above'], ['anti', 'against'], ['de', 'down, or remove'], ['trans', 'across'],
  ['co', 'together'], ['semi', 'half'], ['tri', 'three'], ['bi', 'two'], ['uni', 'one'], ['multi', 'many'], ['mid', 'middle'],
].map(([text, fallback]) => ({ text, kind: 'prefix' as const, meaning: meaningOf(text, 'prefix', fallback) }));

export const WORD_PARTS_SOURCE: Provenance = { source: 'Word Explorer word part finder, needs her review', license: 'Owned' };

const POS_CODE: Record<string, PartOfSpeech> = { n: 'noun', v: 'verb', a: 'adjective', r: 'adverb' };
export const mainPos = (w: string): PartOfSpeech | undefined => POS_CODE[(indexWord(w)?.pos ?? '')[0]?.toLowerCase() ?? ''];
const known = (w: string) => { const x = indexWord(w); return !!x && (x.hasEntry || !!x.pos) && !isBlockedTerm(w); };

export interface Part { text: string; kind: 'prefix' | 'base' | 'suffix'; meaning: string }
export interface WordSum { word: string; parts: Part[]; sum: string; notes: string[]; posChange?: { from: string; fromPos?: PartOfSpeech; to: PartOfSpeech; suffix: string } }

// Adding a suffix with the spelling rules: drop a silent e, change y to i, double a final consonant.
export function addSuffix(stem: string, suffix: string): { word: string; mark: string; note?: string } {
  const vowelStart = /^[aeiouy]/.test(suffix);
  if (vowelStart && /[^aeiou]e$/.test(stem) && !/(ce|ge)$/.test(stem)) return { word: stem.slice(0, -1) + suffix, mark: `${stem}/`, note: `Drop the e in ${stem}.` };
  if (/[^aeiou]y$/.test(stem) && !suffix.startsWith('i')) return { word: `${stem.slice(0, -1)}i${suffix === 's' ? 'es' : suffix}`, mark: `${stem}/i`, note: `Change the y in ${stem} to i.` };
  if (vowelStart && /^[^aeiou]*[aeiou][bdgmnprt]$/.test(stem) && stem.length <= 4) return { word: stem + stem.slice(-1) + suffix, mark: `${stem} + ${stem.slice(-1)}`, note: `Double the ${stem.slice(-1)} in ${stem}.` };
  return { word: stem + suffix, mark: stem };
}

// Is `word` really built from `stem` (not just spelled with it, like corn-er)? A form of the word, a WordNet
// family or opposite link, or a meaning that uses the stem.
async function related(word: string, stem: string, inflection: boolean): Promise<boolean> {
  if (inflection && baseWords(word).includes(stem)) return true;
  const [a, b] = await Promise.all([rawWord(word), rawWord(stem)]);
  const links = (r: typeof a) => (r?.parts ?? []).flatMap((p) => p.senses.flatMap((s) => [...(s.fam ?? []).map((f) => f[0]), ...(s.ant ?? [])]));
  if (links(a).includes(stem) || links(b).includes(word)) return true;
  const defs = (a?.parts ?? []).flatMap((p) => p.senses.map((s) => s.def.toLowerCase()));
  const stemRe = new RegExp(`\\b${stem.slice(0, Math.max(3, stem.length - 1))}`);
  return defs.some((d) => stemRe.test(d));
}

const baseMeaning = async (w: string) => {
  const r = await rawWord(w);
  const d = r?.parts[0]?.senses[0]?.def ?? '';
  return d.split(/;/)[0];
};

// One word's word sum, or null when it is a base word on its own.
export async function wordSum(word: string, depth = 0): Promise<WordSum | null> {
  if (depth > 2) return null;
  for (const s of [...SUFFIXES].sort((a, b) => b.text.length - a.text.length)) {
    if (!word.endsWith(s.text) || word.length - s.text.length < 3) continue;
    const cut = word.slice(0, -s.text.length);
    // [stem, how the sum marks the spelling change, plain note]
    const tries: [string, string, string?][] = [[cut, '']];
    if (/i$/.test(cut)) tries.push([`${cut.slice(0, -1)}y`, '/i', 'Change the y to i.']);
    tries.push([`${cut}e`, '/', 'Drop the e.']);
    if (/(.)\1$/.test(cut)) tries.push([cut.slice(0, -1), ` + ${cut.slice(-1)}`, `Double the ${cut.slice(-1)}.`]);
    for (const [stem, mark, note] of tries) {
      if (stem === word || !known(stem)) continue;
      const fromPos = mainPos(stem);
      if (s.from && fromPos && !s.from.includes(fromPos)) continue;
      if (!(await related(word, stem, !!s.inflection))) continue;
      const inner = await wordSum(stem, depth + 1);
      const parts: Part[] = inner ? inner.parts : [{ text: stem, kind: 'base', meaning: await baseMeaning(stem) }];
      const sumLeft = (inner ? inner.sum.split(' → ')[0] : stem) + mark;
      return {
        word,
        parts: [...parts, { text: s.text, kind: 'suffix', meaning: s.meaning }],
        sum: `${sumLeft} + ${s.text} → ${word}`,
        notes: [...(inner?.notes ?? []), ...(note ? [note] : [])],
        posChange: s.to && !s.inflection ? { from: stem, fromPos, to: s.to, suffix: s.text } : inner?.posChange,
      };
    }
  }
  for (const p of [...PREFIXES].sort((a, b) => b.text.length - a.text.length)) {
    if (!word.startsWith(p.text) || word.length - p.text.length < 3) continue;
    const rest = word.slice(p.text.length);
    if (!known(rest) || !(await related(word, rest, false))) continue;
    const inner = await wordSum(rest, depth + 1);
    const parts: Part[] = inner ? inner.parts : [{ text: rest, kind: 'base', meaning: await baseMeaning(rest) }];
    return {
      word,
      parts: [{ text: p.text, kind: 'prefix', meaning: p.meaning }, ...parts],
      sum: `${p.text} + ${inner ? inner.sum.split(' → ')[0] : rest} → ${word}`,
      notes: inner?.notes ?? [],
      posChange: inner?.posChange,
    };
  }
  return null;
}

// The base a word is built on (unhappiness -> happy).
export async function baseOf(word: string): Promise<string> {
  const s = await wordSum(word);
  return s?.parts.find((p) => p.kind === 'base')?.text ?? word;
}

export interface Matrix { base: string; prefixes: string[]; suffixes: string[]; words: WordSum[] }
// The word matrix for a family: every word in the dictionary built from the base with these prefixes and suffixes.
export async function wordMatrix(base: string): Promise<Matrix> {
  const candidates = new Set<string>();
  const derivational = SUFFIXES.filter((s) => !['s', 'es'].includes(s.text));
  for (const s of derivational) candidates.add(addSuffix(base, s.text).word);
  for (const p of PREFIXES) {
    candidates.add(p.text + base);
    for (const s of derivational) candidates.add(addSuffix(p.text + base, s.text).word);
  }
  for (const s of derivational) { const once = addSuffix(base, s.text).word; for (const t of ['ly', 'ness', 'ful', 'less', 'ment', 'er']) candidates.add(addSuffix(once, t).word); }
  const words: WordSum[] = [];
  for (const w of candidates) {
    if (w === base || !known(w)) continue;
    const sum = await wordSum(w);
    if (sum && sum.parts.some((p) => p.kind === 'base' && p.text === base)) words.push(sum);
  }
  words.sort((a, b) => a.parts.length - b.parts.length || a.word.localeCompare(b.word));
  const prefixes = [...new Set(words.flatMap((w) => w.parts.filter((p) => p.kind === 'prefix').map((p) => p.text)))];
  const suffixes = [...new Set(words.flatMap((w) => w.parts.filter((p) => p.kind === 'suffix').map((p) => p.text)))];
  return { base, prefixes, suffixes, words: words.slice(0, 24) };
}
