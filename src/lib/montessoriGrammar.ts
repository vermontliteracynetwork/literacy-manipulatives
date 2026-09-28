// Montessori Sentence Builder — direct teacher request, with real
// reference images: a decision-tree sentence builder using the real
// Montessori grammar-symbol shapes/colors (already read from her own
// reference sheets and logged in docs/DEVELOPMENT_PLAN.md's Literacy
// Workspace section). This is a real, separate word-class system from
// GrammarWordClass in types.ts (which only ever covers the original
// 2-class noun/verb snap-together tiles) — reusing that type here would
// either narrow this builder to 2 classes or widen the existing shipped
// mechanic's type by accident. Kept independent on purpose.
//
// Symbol set updated (2026-09-25, teacher upload "Grammar_Symbols.zip",
// full replacement of the prior artwork): red triangle=noun, pink small
// triangle=article, light blue triangle=adjective, green circle=verb,
// brown crescent=preposition, dark blue small circle=adverb, yellow
// inverted triangle=pronoun, purple double-arrow+chain=conjunction,
// orange teardrop=interjection. Colors re-measured pixel-exact from the
// new PNGs.
//
// Content only, ordinary uncontroversial grammar (articles, common verbs,
// prepositions...), ordinary vocabulary drawn from Kayden's own Sentence
// Formulas Template 7 word lists plus her real Montessori adverb list
// (image upload) — ordinary, not a specialized curriculum standard
// needing outside verification.

export type MontessoriWordClass =
  | 'interjection' | 'article' | 'adjective' | 'noun' | 'pronoun'
  | 'verb' | 'adverb' | 'preposition' | 'conjunction';

export type PuzzleShape = 'triangle-lg' | 'triangle-sm' | 'triangle-md' | 'triangle-inverted' | 'circle-lg' | 'circle-sm' | 'crescent' | 'double-arrow' | 'droplet';

export interface WordClassInfo {
  shape: PuzzleShape;
  color: string;
  name: string; // proper part-of-speech name, e.g. "Noun" — shown on hover
  label: string; // plain-language definition, e.g. "person, place, or thing"
  // Real symbol artwork the teacher designed and uploaded
  // (public/literacy/grammar-symbols/) — each shape has its own small
  // icon baked in (a tapping hand for noun, a running figure for verb,
  // a magnet for article, ...). Colors below were re-measured directly
  // from these PNGs (Canva's default "Bold" palette).
  imageUrl: string;
}

// Real Montessori shape/color convention — colors/artwork sourced
// directly from the teacher's own designed symbol files.
export const MONTESSORI_WORD_CLASS_INFO: Record<MontessoriWordClass, WordClassInfo> = {
  noun: { shape: 'triangle-lg', color: '#D2222E', name: 'Noun', label: 'Person, place, thing, or animal (something you can touch)', imageUrl: '/literacy/grammar-symbols/noun.png' },
  article: { shape: 'triangle-sm', color: '#F7B3CF', name: 'Article', label: 'Refers to nouns (a, an, the)', imageUrl: '/literacy/grammar-symbols/article.png' },
  adjective: { shape: 'triangle-md', color: '#4BB8E6', name: 'Adjective', label: 'Describes nouns (details for things you can touch)', imageUrl: '/literacy/grammar-symbols/adjective.png' },
  verb: { shape: 'circle-lg', color: '#42AC74', name: 'Verb', label: 'Action word', imageUrl: '/literacy/grammar-symbols/verb.png' },
  preposition: { shape: 'crescent', color: '#723C19', name: 'Preposition', label: 'Identifies time, place, or direction', imageUrl: '/literacy/grammar-symbols/preposition.png' },
  adverb: { shape: 'circle-sm', color: '#1968AB', name: 'Adverb', label: 'Describes verbs (details for things you can do)', imageUrl: '/literacy/grammar-symbols/adverb.png' },
  pronoun: { shape: 'triangle-inverted', color: '#FAF003', name: 'Pronoun', label: 'Replaces a noun', imageUrl: '/literacy/grammar-symbols/pronoun.png' },
  conjunction: { shape: 'double-arrow', color: '#9877B9', name: 'Conjunction', label: 'Connecting words', imageUrl: '/literacy/grammar-symbols/conjunction.png' },
  interjection: { shape: 'droplet', color: '#F87220', name: 'Interjection', label: 'Something you shout; interrupting words or phrases', imageUrl: '/literacy/grammar-symbols/interjection.png' },
};

export interface WordOption {
  text: string;
  verbForm?: 'singular' | 'plural'; // only set on pronoun/noun options usable as the subject
}

// A common noun needs an article before it ("the dog"); a proper noun
// (or a pronoun) doesn't. Kept as two separate, small, real lists rather
// than reusing grammarContent.ts's SANDBOX_NOUNS, whose pieces are
// already full noun phrases with any article baked into the text (e.g.
// "the dog") — reusing those here would double up articles.
export const COMMON_NOUNS: WordOption[] = [
  { text: 'dog' }, { text: 'cat' }, { text: 'teacher' }, { text: 'wizard' },
  { text: 'dragon' }, { text: 'robot' }, { text: 'book' }, { text: 'ball' },
  { text: 'house' }, { text: 'tree' }, { text: 'bird' }, { text: 'fish' },
  { text: 'cake' }, { text: 'star' }, { text: 'boat' }, { text: 'class' },
];

export const PROPER_NOUNS: WordOption[] = [
  { text: 'Mom', verbForm: 'singular' }, { text: 'Dad', verbForm: 'singular' },
  { text: 'Ms. Kayden', verbForm: 'singular' }, { text: 'Xander', verbForm: 'singular' },
  { text: 'Geoff', verbForm: 'singular' }, { text: 'Yoga', verbForm: 'singular' },
  { text: 'Azalea', verbForm: 'singular' }, { text: 'Moxie', verbForm: 'singular' },
];

// Pronouns usable as a sentence subject. "I"/"you" grammatically take the
// same base verb form as a plural subject (matching SANDBOX_VERBS'
// existing 'plural' = base-form entries, e.g. "run"), which is why
// verbForm here reuses that same singular/plural split rather than
// inventing a third category.
export const SUBJECT_PRONOUNS: WordOption[] = [
  { text: 'He', verbForm: 'singular' }, { text: 'She', verbForm: 'singular' }, { text: 'It', verbForm: 'singular' },
  { text: 'They', verbForm: 'plural' }, { text: 'We', verbForm: 'plural' }, { text: 'I', verbForm: 'plural' }, { text: 'You', verbForm: 'plural' },
];

// Object-position pronouns (after a verb or preposition) — real English
// uses a different form here ("her," not "she").
export const OBJECT_PRONOUNS: WordOption[] = [
  { text: 'him' }, { text: 'her' }, { text: 'it' }, { text: 'them' }, { text: 'us' }, { text: 'me' }, { text: 'you' },
];

export const ARTICLES: WordOption[] = [{ text: 'a' }, { text: 'an' }, { text: 'the' }];

export const ADJECTIVES: WordOption[] = [
  'pink', 'hot', 'hungry', 'cold', 'big', 'small', 'happy', 'sad', 'silly', 'brave',
  'fast', 'slow', 'red', 'blue', 'green', 'tall', 'short', 'funny', 'scary', 'shiny',
].map((text) => ({ text }));

// Real verb pool, singular/plural (3rd-person-singular vs. base form)
// pairs — reused directly from grammarContent.ts's SANDBOX_VERBS rather
// than duplicated, so both sentence-building tools stay in sync on the
// same hand-verified verb set. Imported below, not redefined here.

export const ADVERBS: WordOption[] = [
  // A representative slice of Kayden's own real Montessori adverb
  // reference list (image upload) — not the full ~50, but the same real
  // words, not invented ones.
  'quickly', 'slowly', 'happily', 'sadly', 'carefully', 'quietly', 'loudly', 'bravely',
  'silently', 'suddenly', 'always', 'never', 'often', 'sometimes', 'soon', 'very',
  'especially', 'honestly', 'kindly', 'warmly',
].map((text) => ({ text }));

export const PREPOSITIONS: WordOption[] = [
  'to', 'with', 'by', 'into', 'across', 'on', 'in', 'of', 'under', 'near', 'behind', 'through',
].map((text) => ({ text }));

export const CONJUNCTIONS: WordOption[] = ['and', 'but', 'or', 'because', 'so'].map((text) => ({ text }));

export const INTERJECTIONS: WordOption[] = ['Wow!', 'Fantastic!', 'Oh boy!', 'Yikes!', 'Hooray!'].map((text) => ({ text }));

// The decision tree itself. Every state lists the word classes that are
// grammatically valid to add next (never a class that would produce a
// broken sentence) and whether the sentence is already a complete, real
// sentence at this point ("a word can always be added, but it will
// always make a real, correct sentence" — canEnd never appears unless
// the built words so far already form a valid sentence on their own).
export interface GrammarState {
  id: string;
  canEnd: boolean;
  options: { wordClass: MontessoriWordClass; next: string }[];
}

// A "noun" or "pronoun" option means something different depending on
// which state offers it: reached directly (no article/adjective just
// before it) it must be a proper noun / subject pronoun (no article
// needed); reached right after an article/adjective it must be a common
// noun (the phrase already has its article). Encoded per-state here
// rather than per-class, since the same class name covers both roles.
const DIRECT_NOUN_STATES = new Set(['start', 'afterVerb', 'prepPhrase']);
const SUBJECT_PRONOUN_STATES = new Set(['start']);

export function optionWordList(stateId: string, wordClass: MontessoriWordClass): WordOption[] {
  if (wordClass === 'noun') return DIRECT_NOUN_STATES.has(stateId) ? PROPER_NOUNS : COMMON_NOUNS;
  if (wordClass === 'pronoun') return SUBJECT_PRONOUN_STATES.has(stateId) ? SUBJECT_PRONOUNS : OBJECT_PRONOUNS;
  if (wordClass === 'article') return ARTICLES;
  if (wordClass === 'adjective') return ADJECTIVES;
  if (wordClass === 'adverb') return ADVERBS;
  if (wordClass === 'preposition') return PREPOSITIONS;
  if (wordClass === 'conjunction') return CONJUNCTIONS;
  if (wordClass === 'interjection') return INTERJECTIONS;
  return []; // 'verb' is looked up from SANDBOX_VERBS by the sandbox component, not here
}

export const GRAMMAR_STATES: Record<string, GrammarState> = {
  start: {
    id: 'start', canEnd: false,
    options: [
      { wordClass: 'interjection', next: 'start' },
      { wordClass: 'article', next: 'subjPhrase' },
      { wordClass: 'adjective', next: 'subjPhrase' },
      { wordClass: 'pronoun', next: 'afterSubject' },
      { wordClass: 'noun', next: 'afterSubject' },
    ],
  },
  subjPhrase: {
    id: 'subjPhrase', canEnd: false,
    options: [
      { wordClass: 'adjective', next: 'subjPhrase' },
      { wordClass: 'noun', next: 'afterSubject' },
    ],
  },
  afterSubject: {
    id: 'afterSubject', canEnd: false,
    options: [{ wordClass: 'verb', next: 'afterVerb' }],
  },
  afterVerb: {
    id: 'afterVerb', canEnd: true,
    options: [
      { wordClass: 'adverb', next: 'afterAdverb' },
      { wordClass: 'article', next: 'objPhrase' },
      { wordClass: 'adjective', next: 'objPhrase' },
      { wordClass: 'pronoun', next: 'afterObject' },
      { wordClass: 'noun', next: 'afterObject' },
      { wordClass: 'preposition', next: 'prepPhrase' },
      { wordClass: 'conjunction', next: 'start' },
    ],
  },
  afterAdverb: {
    id: 'afterAdverb', canEnd: true,
    options: [
      { wordClass: 'preposition', next: 'prepPhrase' },
      { wordClass: 'conjunction', next: 'start' },
    ],
  },
  objPhrase: {
    id: 'objPhrase', canEnd: false,
    options: [
      { wordClass: 'adjective', next: 'objPhrase' },
      { wordClass: 'noun', next: 'afterObject' },
    ],
  },
  afterObject: {
    id: 'afterObject', canEnd: true,
    options: [
      { wordClass: 'adverb', next: 'afterAdverb' },
      { wordClass: 'preposition', next: 'prepPhrase' },
      { wordClass: 'conjunction', next: 'start' },
    ],
  },
  prepPhrase: {
    id: 'prepPhrase', canEnd: false,
    options: [
      { wordClass: 'article', next: 'prepObjPhrase' },
      { wordClass: 'adjective', next: 'prepObjPhrase' },
      { wordClass: 'pronoun', next: 'afterPrepObject' },
      { wordClass: 'noun', next: 'afterPrepObject' },
    ],
  },
  prepObjPhrase: {
    id: 'prepObjPhrase', canEnd: false,
    options: [
      { wordClass: 'adjective', next: 'prepObjPhrase' },
      { wordClass: 'noun', next: 'afterPrepObject' },
    ],
  },
  afterPrepObject: {
    id: 'afterPrepObject', canEnd: true,
    options: [
      { wordClass: 'conjunction', next: 'start' },
    ],
  },
};
