import type { Example, FrequencyBand, PartOfSpeech, Provenance, ReviewStatus, Sense, Tier, WordEntry, WordForms } from './types';
import { isBlockedTerm, isBlockedText } from './safety';
import { soundOutFromIpa } from './soundOut';
import { loadWordTypes, typesOf, type WordType } from '../wordTypes';
import { pastOf, third } from '../writer/tenses';
import { SEED_ENTRIES, type SeedSense } from './seed';
import { statusOf } from './review';
import { timeOf } from './time';
import { formulaFor } from './formula';
import { phonicsOf } from './phonics';
import { pictureFor, TWEMOJI } from './pictures';
import { loadWords } from '../writer/spell';

// Loads the dictionary data built by scripts/build-word-explorer-data.py and turns it into WordEntry records.
// UI-free.

export const OEWN: Provenance = {
  source: 'Open English WordNet 2024',
  license: 'CC BY 4.0',
  attribution: 'Open English WordNet (2024 edition), CC BY 4.0',
  url: 'https://github.com/globalwordnet/english-wordnet',
};
export const WORD_LIST: Provenance = {
  source: 'SCOWL word list size levels (stand-in until frequency counts are added)',
  license: 'SCOWL copyright notice, see public/writer/WORDLIST-COPYRIGHT.txt',
};
export const ESTIMATE: Provenance = { source: 'Estimated by Word Explorer from frequency, needs review', license: 'Owned' };
export const IPA_SOURCE: Provenance = { ...OEWN, source: 'Open English WordNet 2024 pronunciations, respelled by Word Explorer' };
export const CMU: Provenance = { source: 'CMU Pronouncing Dictionary, letters lined up with sounds by Word Explorer', license: 'BSD-style (CMU)', url: 'https://github.com/cmusphinx/cmudict' };
export const DRAFTED: Provenance = { source: 'Drafted for her review (not yet approved)', license: 'Owned' };

// ---------- the index (every word, for search) ----------
export interface IndexWord { word: string; pos: string; band: FrequencyBand; hasEntry: boolean }
interface RawIndex { words: [string, string, number, number][]; forms: Record<string, string> }
let index: IndexWord[] = [];
let byWord = new Map<string, IndexWord>();
let forms: Record<string, string> = {};
let loadingIndex: Promise<void> | null = null;
const listeners = new Set<() => void>();
export const onIndex = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };

export function loadIndex(): Promise<void> {
  loadingIndex ??= fetch('/word-explorer/index.json')
    .then((r) => (r.ok ? r.json() : { words: [], forms: {} }))
    .then((d: RawIndex) => {
      index = d.words.filter(([w]) => !isBlockedTerm(w)).map(([word, pos, band, has]) => ({ word, pos, band: band as FrequencyBand, hasEntry: !!has }));
      for (const seed of Object.keys(SEED_ENTRIES)) if (!index.some((x) => x.word === seed)) index.push({ word: seed, pos: '', band: 3, hasEntry: true });
      index.sort((a, b) => (a.word < b.word ? -1 : a.word > b.word ? 1 : 0));
      byWord = new Map(index.map((x) => [x.word, x]));
      forms = d.forms;
      listeners.forEach((f) => f());
    })
    .catch(() => { loadingIndex = null; });
  return loadingIndex;
}
export const indexReady = () => index.length > 0;
export const allWords = () => index;
export const indexWord = (w: string) => byWord.get(w.toLowerCase());
export const irregularBase = (w: string) => forms[w.toLowerCase()];

// ---------- one word's raw meanings ----------
export interface RawSense { id: string; def: string; lex: string; ex?: string[]; syn?: string[]; sim?: string[]; ant?: string[]; fam?: [string, string][] }
export interface RawWord { ipa?: string; parts: { pos: 'noun' | 'verb' | 'adjective' | 'adverb'; forms?: string[]; senses: RawSense[] }[] }
const shards = new Map<string, Promise<Record<string, RawWord>>>();
const shardKey = (w: string) => (`${w}_`).slice(0, 2).replace(/[^a-z]/g, '_');
export function rawWord(w: string): Promise<RawWord | undefined> {
  const k = shardKey(w);
  if (!shards.has(k)) {
    shards.set(k, fetch(`/word-explorer/entries/${k}.json`).then((r) => (r.ok ? r.json() : {})).catch(() => { shards.delete(k); return {}; }));
  }
  return shards.get(k)!.then((s) => s[w]);
}

// ---------- building an entry ----------
const WORDTYPE_POS: Partial<Record<WordType, PartOfSpeech>> = {
  noun: 'noun', propernoun: 'noun', verb: 'verb', adjective: 'adjective', adverb: 'adverb', pronoun: 'pronoun',
  preposition: 'preposition', conjunction: 'conjunction', interjection: 'interjection', article: 'article',
};

export function tierFor(band: FrequencyBand, lex = ''): Tier {
  if (band <= 2) return 1;
  if (band >= 4 && /noun\.(animal|plant|body|substance|phenomenon)|verb\.weather/.test(lex)) return 3;
  return 2;
}

const VOWEL = /[aeiou]/;
const doubles = (w: string) => /^[^aeiou]*[aeiou][bdgklmnprt]$/.test(w) && w.length <= 4;
export function regularForms(word: string, pos: PartOfSpeech, irregular: string[] = []): WordForms {
  const f: WordForms = { irregular: irregular.length > 0 };
  if (pos === 'noun') {
    f.plural = irregular.find((x) => !x.endsWith("'s")) ?? (/[^aeiou]y$/.test(word) ? `${word.slice(0, -1)}ies` : /(s|sh|ch|x|z)$/.test(word) ? `${word}es` : `${word}s`);
    f.possessive = `${word}'s`;
  } else if (pos === 'verb') {
    const ing = irregular.find((x) => x.endsWith('ing'));
    const other = irregular.filter((x) => !x.endsWith('ing'));
    const past = pastOf(word);
    f.past = other[0] && past.endsWith('ed') ? other[0] : past;
    f.pastParticiple = other[1] ?? (other[0] && other[0] !== f.past ? other[0] : f.past);
    f.present = [word, third(word)];
    f.future = `will ${word}`;
    f.ing = ing ?? (/ie$/.test(word) ? `${word.slice(0, -2)}ying` : /[^e]e$/.test(word) ? `${word.slice(0, -1)}ing` : doubles(word) ? `${word}${word.slice(-1)}ing` : `${word}ing`);
  } else if (pos === 'adjective') {
    const er = irregular.find((x) => /er$/.test(x)) ?? irregular[0];
    const est = irregular.find((x) => /est$/.test(x)) ?? irregular[1];
    const syllables = (word.match(/[aeiouy]+/g) ?? []).length - (/[^aeiouy]e$/.test(word) ? 1 : 0);
    if (er) { f.comparative = er; f.superlative = est; } else if (syllables <= 1 || (syllables === 2 && /y$/.test(word))) {
      const stem = /[^aeiou]y$/.test(word) ? `${word.slice(0, -1)}i` : /e$/.test(word) ? word.slice(0, -1) : doubles(word) && VOWEL.test(word) ? `${word}${word.slice(-1)}` : word;
      f.comparative = `${stem}er`; f.superlative = `${stem}est`;
    } else { f.comparative = `more ${word}`; f.superlative = `most ${word}`; }
  }
  return f;
}

function signpostFor(s: RawSense): string {
  const near = s.syn?.[0] ?? s.sim?.[0];
  if (near) return near.replace(/_/g, ' ');
  return s.def.split(/[;,]/)[0].split(' ').slice(0, 4).join(' ');
}

function seedSense(word: string, s: SeedSense, i: number): Sense {
  const id = `${word}#seed${i}`;
  const st = (k: string) => statusOf(`${id}:${k}`, 'draft');
  return {
    id, signpost: s.signpost, pos: s.pos,
    definition: { value: s.definition, provenance: [DRAFTED], status: st('sense') },
    explanation: { value: s.explanation, provenance: [DRAFTED], status: st('sense') },
    grammar: { patterns: s.patterns ?? [], countable: s.countable, needsObject: s.needsObject },
    examples: s.examples.map((text) => ({ text, formulaCode: formulaFor(text), time: timeOf(text), provenance: [DRAFTED], status: st('sense') })),
    synonyms: [], antonyms: [], pictures: [], pictureable: false, safetyRating: 'ok', family: [],
  };
}

function oewnSense(word: string, pos: PartOfSpeech, s: RawSense): Sense {
  const status: ReviewStatus = statusOf(`${s.id}:sense`, 'draft');
  const examples: Example[] = (s.ex ?? []).filter((t) => !isBlockedText(t)).map((text) => ({ text, formulaCode: formulaFor(text), time: timeOf(text), provenance: [OEWN], status }));
  const near = [...(s.syn ?? []), ...(s.sim ?? [])].filter((w) => !isBlockedTerm(w));
  return {
    id: s.id, signpost: signpostFor(s), pos,
    definition: { value: s.def, provenance: [OEWN], status },
    explanation: { value: '', provenance: [], status: 'draft' },
    grammar: { patterns: [] },
    examples,
    synonyms: near.map((w, i) => {
      const band = indexWord(w)?.band ?? 5;
      return { wordId: w, closeness: i < (s.syn?.length ?? 0) ? 1 : 0.7, tier: tierFor(band), frequencyBand: band };
    }),
    antonyms: (s.ant ?? []).filter((w) => !isBlockedTerm(w)).map((w) => ({ wordId: w, type: /^(un|in|im|dis|non|ir|il)/.test(w) && w.endsWith(word.slice(-3)) ? 'prefix' as const : 'either-or' as const })),
    pictures: [], pictureable: pos === 'noun' && /noun\.(animal|plant|artifact|food|object|body)/.test(s.lex), safetyRating: 'ok',
    family: (s.fam ?? []).filter(([w]) => !isBlockedTerm(w)).map(([w, p]) => ({ wordId: w, pos: p as PartOfSpeech })),
  };
}

const cache = new Map<string, Promise<WordEntry | null>>();
export function getEntry(raw: string): Promise<WordEntry | null> {
  const word = raw.trim().toLowerCase();
  if (!word || isBlockedTerm(word)) return Promise.resolve(null);
  if (!cache.has(word)) cache.set(word, buildEntry(word));
  return cache.get(word)!;
}
// Forget built entries (after a review status changes, so the page shows the new status).
export const clearEntryCache = () => cache.clear();

async function buildEntry(word: string): Promise<WordEntry | null> {
  await Promise.all([loadIndex(), loadWordTypes(), loadWords()]);
  const rw = await rawWord(word);
  const seed = SEED_ENTRIES[word];
  const iw = indexWord(word);
  const types = typesOf(word);
  if (!rw && !seed && !iw && !types) return null;

  const band: FrequencyBand = iw?.band ?? 5;
  const senses: Sense[] = [];
  const matched = new Set<string>();
  seed?.senses.forEach((s, i) => {
    const sense = seedSense(word, s, i);
    // A drafted meaning borrows synonyms, opposites and family from the WordNet meaning it matches.
    const part = rw?.parts.find((p) => p.pos === s.pos);
    const m = s.oewn ? part?.senses.find((x) => x.id === s.oewn) : undefined;
    if (m) {
      const o = oewnSense(word, s.pos, m);
      Object.assign(sense, { synonyms: o.synonyms, antonyms: o.antonyms, family: o.family, pictureable: o.pictureable });
      matched.add(m.id);
    }
    senses.push(sense);
  });
  for (const p of rw?.parts ?? []) for (const s of p.senses) if (!matched.has(s.id)) senses.push(oewnSense(word, p.pos, s));

  const [ph, pic] = await Promise.all([phonicsOf(word), pictureFor(word)]);
  if (pic) {
    const target = senses.find((x) => x.pos === 'noun' && x.pictureable) ?? senses.find((x) => x.pos === 'noun') ?? senses[0];
    if (target) { target.pictures = [{ assetId: pic.file, provenance: [TWEMOJI] }]; target.pictureable = true; }
  }

  const parts: PartOfSpeech[] = [];
  for (const t of [...(types?.common ?? []), ...(types?.all ?? [])]) { const p = WORDTYPE_POS[t]; if (p && !parts.includes(p)) parts.push(p); }
  for (const s of senses) if (!parts.includes(s.pos)) parts.push(s.pos);

  const main = senses[0]?.pos ?? parts[0];
  const irregular = rw?.parts.find((p) => p.pos === main)?.forms ?? [];
  const formsValue = main ? regularForms(word, main, irregular) : { irregular: false };
  const entryStatus = statusOf(`${word}:entry`, 'draft');
  const soundOut = seed?.soundOut ?? soundOutFromIpa(rw?.ipa);

  return {
    id: word, headword: word, lemma: word, soundOut, ipa: rw?.ipa,
    capitalLetter: !!types && types.common[0] === 'propernoun',
    variants: [],
    forms: { value: formsValue, provenance: irregular.length ? [OEWN, ESTIMATE] : [ESTIMATE], status: entryStatus },
    senses,
    tier: { value: seed?.tier ?? tierFor(band, rw?.parts[0]?.senses[0]?.lex), provenance: [ESTIMATE], status: entryStatus },
    frequencyBand: { value: band, provenance: [WORD_LIST], status: entryStatus },
    subjectTags: [],
    safety: { blocked: false },
    homophones: [], homographs: [], confusables: [],
    phonics: ph ? {
      value: { graphemes: ph.graphemes, syllables: ph.syllables },
      provenance: [CMU],
      // Alignments that used only listed patterns are shown; ones that needed another spelling wait for her review.
      status: statusOf(`${word}:phonics`, ph.uncertain ? 'draft' : 'approved'),
    } : undefined,
    phonicsUncertain: !!ph?.uncertain,
    status: entryStatus,
    partsOfSpeech: parts,
  };
}
