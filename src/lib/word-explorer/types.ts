// Word Explorer data model (build spec section 5). UI-free: the kids dashboard and the Symbolic Grammar curriculum
// reuse these types and the engines next to them.

export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb' | 'pronoun'
  | 'preposition' | 'conjunction' | 'interjection' | 'article';
export type Tier = 1 | 2 | 3;
export type FrequencyBand = 1 | 2 | 3 | 4 | 5; // 1 = very common
export type Time = 'past' | 'present' | 'future';
export type ReviewStatus = 'draft' | 'reviewed' | 'approved';
export type SyllableType = 'closed' | 'open' | 'silent e' | 'vowel team' | 'r-controlled' | 'consonant-le' | 'diphthong';

export interface Provenance {
  source: string;
  license: string;
  attribution?: string;
  url?: string;
}

export interface Field<T> { value: T; provenance: Provenance[]; status: ReviewStatus }

export interface WordForms {
  past?: string; present?: string[]; future?: string;
  ing?: string; pastParticiple?: string;
  plural?: string; possessive?: string;
  comparative?: string; superlative?: string;
  irregular: boolean;
}

export interface Example {
  text: string; formulaCode: string; time?: Time;
  provenance: Provenance[]; status: ReviewStatus;
}

export interface Sense {
  id: string;
  signpost: string;
  pos: PartOfSpeech;
  definition: Field<string>;
  explanation: Field<string>;
  grammar: { countable?: boolean; needsObject?: boolean; patterns: string[] };
  examples: Example[];
  synonyms: { wordId: string; closeness: number; tier: Tier; frequencyBand: FrequencyBand }[];
  antonyms: { wordId: string; type: 'scale' | 'either-or' | 'direction' | 'prefix' }[];
  scale?: string[];
  pictures: { assetId: string; provenance: Provenance[] }[];
  pictureable: boolean;
  safetyRating: 'ok' | 'teacher-only' | 'blocked';
  family: { wordId: string; pos: PartOfSpeech }[];
}

export interface WordEntry {
  id: string;
  headword: string;
  lemma: string;
  soundOut: string;
  ipa?: string;
  audio?: string;
  capitalLetter: boolean;
  variants: string[];
  forms: Field<WordForms>;
  senses: Sense[];
  phonics?: Field<{
    graphemes: { letters: string; sound: string; patternId: string }[];
    syllables: { text: string; type: SyllableType }[];
  }>;
  morphology?: Field<{
    parts: { text: string; kind: 'prefix' | 'base' | 'suffix' | 'combining-form';
             meaning: string; origin?: 'Latin' | 'Greek' | 'Old English' | 'Old Norse' | 'French' | 'other';
             rootId?: string }[];
    wordSum: string;
    family: { wordId: string; pos: PartOfSpeech }[];
    compound: boolean;
  }>;
  etymology?: Field<{ note: string }>;
  tier: Field<Tier>;
  frequencyBand: Field<FrequencyBand>;
  subjectTags: string[];
  safety: { blocked: boolean; minBand?: 'K-2' | '3-5' | '6-8' | '9-12' };
  homophones: string[]; homographs: string[]; confusables: string[];
  status: ReviewStatus;
  // Every part of speech the word can be, most common first (from the word type engine), for the header symbols.
  partsOfSpeech: PartOfSpeech[];
}

export const PART_NAMES: Record<PartOfSpeech, string> = {
  noun: 'noun', verb: 'verb', adjective: 'adjective', adverb: 'adverb', pronoun: 'pronoun',
  preposition: 'preposition', conjunction: 'conjunction', interjection: 'interjection', article: 'article',
};

// Students see a field only once it is approved (spec section 10).
export const visibleTo = (status: ReviewStatus, teacher: boolean) => teacher || status === 'approved';
