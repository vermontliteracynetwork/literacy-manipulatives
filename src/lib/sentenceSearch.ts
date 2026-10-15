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
// Possessive words (my, your...) do an adjective's job: they tell which one.
learn(['my', 'your', 'his', 'her', 'its', 'our', 'their', 'this', 'that', 'these', 'those'].map((text) => ({ text })), 'adjective');

// Everyday verbs, so "I like dogs and cats" reads "like" as the action. Each base also counts in its -s,
// -ed and -ing forms; common irregular past forms are listed too.
const VERB_BASES = `be am is are was were been being have has had do does did go goes went gone come came see saw
seen like love want need get got make made take took give gave say said tell told know knew think thought feel felt
look watch hear listen play run ran jump eat ate drink drank sleep slept sit sat stand stood walk swim swam fly flew
read write wrote draw drew sing sang dance ride rode climb throw threw catch caught kick help find found keep kept
live laugh cry smile talk call ask answer open close build built bring brought buy bought sell sold sold wear wore
hold held hug kiss chase hide hid fall fell grow grew paint cook bake clean wash brush pick push pull carry hope care
try tries tried use work learn teach taught start stop wait win won lose lost fix fit hit hurt cut put set let
leave left meet met pay paid send sent spend spent sleep wake woke enjoy hate miss share visit wish wonder bark meow
roar buzz hop skip crawl dig dug fight fought float sink sank shine shone spin spun swing swung tickle wave yell`;
const VERBS = new Set<string>();
const NO_ENDINGS = new Set(['be', 'am', 'is', 'are', 'was', 'were', 'been', 'being', 'has', 'had', 'does', 'did', 'went', 'gone', 'came', 'saw', 'seen', 'got', 'made', 'took', 'gave', 'said', 'told', 'knew', 'thought', 'felt', 'ran', 'ate', 'drank', 'slept', 'sat', 'stood', 'swam', 'flew', 'wrote', 'drew', 'sang', 'rode', 'threw', 'caught', 'found', 'kept', 'built', 'brought', 'bought', 'sold', 'wore', 'held', 'hid', 'fell', 'grew', 'taught', 'won', 'lost', 'left', 'met', 'paid', 'sent', 'spent', 'woke', 'dug', 'fought', 'sank', 'shone', 'spun', 'swung']);
for (const v of VERB_BASES.split(/\s+/)) {
  VERBS.add(v);
  if (NO_ENDINGS.has(v)) continue;
  VERBS.add(v.endsWith('y') && !/[aeiou]y$/.test(v) ? `${v.slice(0, -1)}ies` : /(s|sh|ch|x|z|o)$/.test(v) ? `${v}es` : `${v}s`);
  const stem = v.endsWith('e') ? v.slice(0, -1) : v;
  VERBS.add(`${stem}ed`); VERBS.add(`${stem}ing`); VERBS.add(`${v}ed`); VERBS.add(`${v}ing`);
}
const FUNCTION_CLASSES: MontessoriWordClass[] = ['article', 'pronoun', 'preposition', 'conjunction', 'interjection', 'adjective', 'adverb'];

// Best guess for a word the board hasn't seen: a known verb is a verb; a capital in the middle of a sentence
// is a proper noun; -ly an adverb; -ed / -ing a verb; anything else a noun.
function tagWord(raw: string, first: boolean): MontessoriWordClass {
  const key = raw.toLowerCase();
  const known = LEXICON.get(key);
  if (known && known !== 'noun' && known !== 'propernoun') return known;
  if (VERBS.has(key)) return 'verb';
  if (known) return known === 'propernoun' && !/^[A-Z]/.test(raw) && !first ? 'noun' : known;
  if (/^[A-Z]/.test(raw) && (!first || raw !== raw.toUpperCase()) && !first) return 'propernoun';
  if (first && /^[A-Z][a-z]+$/.test(raw) && !LEXICON.has(key) && !/(s|ed|ing|ly)$/.test(key)) return 'propernoun';
  if (/ly$/.test(key)) return 'adverb';
  if (/(ed|ing)$/.test(key)) return 'verb';
  return 'noun';
}

// A sentence needs a verb. If none was found, the first word after the subject (a pronoun or noun) that
// isn't a small joining word is read as the action.
function ensureVerb(words: PatternWord[]): PatternWord[] {
  if (words.some((w) => w.wordClass === 'verb')) return words;
  const subj = words.findIndex((w) => w.wordClass === 'pronoun' || w.wordClass === 'noun' || w.wordClass === 'propernoun');
  if (subj < 0) return words;
  const i = words.findIndex((w, idx) => idx > subj && !FUNCTION_CLASSES.includes(w.wordClass));
  if (i < 0) return words;
  return words.map((w, idx) => (idx === i ? { ...w, wordClass: 'verb' } : w));
}

export function patternFor(query: string): { words: PatternWord[]; fromNames: boolean } | null {
  const q = query.trim();
  if (!q) return null;
  const names = parseClassNames(q);
  if (names) return { words: names.map((c) => ({ wordClass: c, word: '' })), fromNames: true };
  const raw = q.match(/[A-Za-z']+/g) ?? [];
  if (!raw.length) return null;
  return { words: ensureVerb(raw.map((w, i) => ({ wordClass: tagWord(w, i === 0), word: w }))), fromNames: false };
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

// Grammar Symbols search (her request 2026-10-15): type a word ("jump", "Sam", "quickly") to get its symbol.
// Each typed word is tagged on its own, so "big dog" gives an adjective and a noun.
export function symbolsForWords(query: string): PatternWord[] {
  const raw = query.trim().match(/[A-Za-z']+/g) ?? [];
  return raw.map((w) => ({ wordClass: tagWord(w, false), word: w }));
}
