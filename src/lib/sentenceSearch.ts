// Symbol Sentence search (her request 2026-10-15): type an example sentence ("the big dog jumped") or the parts
// of speech themselves ("proper noun verb adjective") and get the symbol sentences with that same pattern,
// plus the pattern itself to drag out as its own row of symbols.

import {
  ADJECTIVES, ADVERBS, ARTICLES, COMMON_NOUNS, CONJUNCTIONS, INTERJECTIONS, MONTESSORI_WORD_CLASS_INFO,
  OBJECT_PRONOUNS, PREPOSITIONS, PROPER_NOUNS, SUBJECT_PRONOUNS, type MontessoriWordClass,
} from './montessoriGrammar';
import { SANDBOX_VERBS } from './grammarContent';
import { ALL_SYMBOL_SENTENCES, type SymbolSentence } from './symbolSentences';

export interface PatternWord { wordClass: MontessoriWordClass; word: string }

// Part-of-speech names a teacher might type, longest first so "proper noun" wins over "noun".
const CLASS_NAMES: [string, MontessoriWordClass][] = ([
  ['proper nouns', 'propernoun'], ['proper noun', 'propernoun'], ['propernoun', 'propernoun'],
  ['nouns', 'noun'], ['noun', 'noun'], ['verbs', 'verb'], ['verb', 'verb'],
  ['adjectives', 'adjective'], ['adjective', 'adjective'], ['adj', 'adjective'],
  ['adverbs', 'adverb'], ['adverb', 'adverb'], ['adv', 'adverb'],
  ['articles', 'article'], ['article', 'article'], ['pronouns', 'pronoun'], ['pronoun', 'pronoun'],
  ['prepositions', 'preposition'], ['preposition', 'preposition'], ['prep', 'preposition'],
  ['conjunctions', 'conjunction'], ['conjunction', 'conjunction'], ['interjections', 'interjection'], ['interjection', 'interjection'],
] as [string, MontessoriWordClass][]).filter(([, c]) => c in MONTESSORI_WORD_CLASS_INFO);

function parseClassNames(q: string): MontessoriWordClass[] | null {
  let rest = q.toLowerCase().replace(/[,+]/g, ' ').replace(/\s+/g, ' ').trim();
  const out: MontessoriWordClass[] = [];
  while (rest) {
    const hit = CLASS_NAMES.find(([name]) => rest === name || rest.startsWith(`${name} `));
    if (!hit) return null;
    out.push(hit[1]);
    rest = rest.slice(hit[0].length).trim();
  }
  return out.length ? out : null;
}

// Every word the board already knows the job of: the symbol sentence deck itself, then the word banks.
const LEXICON = new Map<string, MontessoriWordClass>();
const learn = (list: { text: string }[], cls: MontessoriWordClass) => {
  if (!(cls in MONTESSORI_WORD_CLASS_INFO)) return;
  for (const { text } of list) {
    const key = text.toLowerCase().replace(/[^a-z' ]/g, '').trim();
    if (key && !LEXICON.has(key)) LEXICON.set(key, cls);
  }
};
for (const s of ALL_SYMBOL_SENTENCES) for (const w of s.words) learn([{ text: w.word }], w.wordClass);
learn(ARTICLES, 'article'); learn(SUBJECT_PRONOUNS, 'pronoun'); learn(OBJECT_PRONOUNS, 'pronoun');
learn(PREPOSITIONS, 'preposition'); learn(CONJUNCTIONS, 'conjunction'); learn(INTERJECTIONS, 'interjection');
learn(ADVERBS, 'adverb'); learn(ADJECTIVES, 'adjective'); learn(SANDBOX_VERBS, 'verb');
learn(PROPER_NOUNS, 'propernoun'); learn(COMMON_NOUNS, 'noun');

// Best guess for a word the board hasn't seen: a capital in the middle of a sentence is a proper noun,
// -ly an adverb, -ed / -ing a verb, anything else a noun.
function tagWord(raw: string, first: boolean): MontessoriWordClass {
  const key = raw.toLowerCase();
  const known = LEXICON.get(key);
  if (known) return known === 'propernoun' && !/^[A-Z]/.test(raw) && !first ? 'noun' : known;
  if (!first && /^[A-Z]/.test(raw) && 'propernoun' in MONTESSORI_WORD_CLASS_INFO) return 'propernoun';
  if (/ly$/.test(key)) return 'adverb';
  if (/(ed|ing)$/.test(key)) return 'verb';
  return 'noun';
}

export function patternFor(query: string): { words: PatternWord[]; fromNames: boolean } | null {
  const q = query.trim();
  if (!q) return null;
  const names = parseClassNames(q);
  if (names) return { words: names.map((c) => ({ wordClass: c, word: '' })), fromNames: true };
  const raw = q.match(/[A-Za-z']+/g) ?? [];
  if (!raw.length) return null;
  return { words: raw.map((w, i) => ({ wordClass: tagWord(w, i === 0), word: w })), fromNames: false };
}

const key = (classes: MontessoriWordClass[]) => classes.join(' ');

// Sentences with exactly this pattern first, then ones whose text contains what was typed.
export function searchSymbolSentences(query: string): { pattern: PatternWord[] | null; matches: SymbolSentence[] } {
  const parsed = patternFor(query);
  const want = parsed ? key(parsed.words.map((w) => w.wordClass)) : '';
  const same = parsed ? ALL_SYMBOL_SENTENCES.filter((s) => key(s.words.map((w) => w.wordClass)) === want) : [];
  const q = query.trim().toLowerCase();
  const text = q ? ALL_SYMBOL_SENTENCES.filter((s) => !same.includes(s) && s.sentence.toLowerCase().includes(q)) : [];
  return { pattern: parsed?.words ?? null, matches: [...same, ...text] };
}
