import type { Example, FrequencyBand, PartOfSpeech, Provenance, ReviewStatus, Sense, Tier, WordEntry, WordForms } from './types';
import { isBlockedTerm, isBlockedText } from './safety';
import { soundOutFromIpa } from './soundOut';
import { loadWordTypes } from '../wordTypes';
import { jobsOfWord } from '../grammarEngine';
import type { SymbolWordClass } from '../grammarSymbols';
import { comparisonOf, ingOf, irregularVerb, pastOf, pastParticipleOf, pluralOf, third } from 'symbolic-grammar-engine';
import { SEED_ENTRIES, type SeedSense } from './seed';
import { statusOf } from './review';
import { timeOf } from './time';
import { formulaFor } from './formula';
import { phonicsOf } from './phonics';
import { pictureFor, provenanceOf } from './pictures';
import { loadWords } from '../writer/spell';
import { CLOSED_DEFS } from './closedWords';

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
// A word's own irregular forms (run: ran, running), from the same list.
let formsOfBase: Map<string, string[]> | null = null;
export function irregularFormsOf(base: string): string[] {
  if (!formsOfBase) { formsOfBase = new Map(); for (const [f, b] of Object.entries(forms)) formsOfBase.set(b, [...(formsOfBase.get(b) ?? []), f]); }
  return formsOfBase.get(base) ?? [];
}

// ---------- one word's raw meanings ----------
export interface RawSense { id: string; def: string; lex: string; ex?: string[]; syn?: string[]; sim?: string[]; hyp?: string[]; ant?: string[]; fam?: [string, string][] }
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
const WORDTYPE_POS: Partial<Record<SymbolWordClass, PartOfSpeech>> = {
  noun: 'noun', propernoun: 'noun', verb: 'verb', adjective: 'adjective', adverb: 'adverb', pronoun: 'pronoun',
  preposition: 'preposition', conjunction: 'conjunction', interjection: 'interjection', article: 'article',
};

export function tierFor(band: FrequencyBand, lex = ''): Tier {
  if (band <= 2) return 1;
  if (band >= 4 && /noun\.(animal|plant|body|substance|phenomenon)|verb\.weather/.test(lex)) return 3;
  return 2;
}

// Every form comes from the Symbolic Grammar Engine (her rule 2026-11-19: no past tense with -ed added to a verb that
// does not take it). WordNet's own irregular forms are used only for a verb the engine's table does not have, and only
// when they are not -ed spellings (WordNet lists British ones like travelled).
export function regularForms(word: string, pos: PartOfSpeech, irregular: string[] = []): WordForms {
  const f: WordForms = { irregular: false };
  if (pos === 'noun') {
    const own = irregular.find((x) => !x.endsWith("'s") && !x.endsWith('s'));
    f.plural = own ?? pluralOf(word);
    f.irregular = f.plural !== `${word}s` && f.plural !== `${word}es` && !/ies$/.test(f.plural);
    f.possessive = `${word}'s`;
  } else if (pos === 'verb') {
    const engine = irregularVerb(word);
    const other = irregular.filter((x) => !/(ing|ed|s)$/.test(x));
    f.past = engine?.past ?? other[0] ?? pastOf(word);
    f.pastParticiple = engine?.participle ?? other[1] ?? other[0] ?? pastParticipleOf(word);
    f.irregular = !!engine || other.length > 0;
    f.present = [word, third(word)];
    f.future = `will ${word}`;
    f.ing = ingOf(word);
  } else if (pos === 'adjective') {
    const er = irregular.find((x) => /er$/.test(x));
    const est = irregular.find((x) => /est$/.test(x));
    const c = comparisonOf(word);
    f.comparative = er ?? c.more; f.superlative = est ?? c.most;
    f.irregular = !!er && !er.startsWith(word.replace(/e$/, '').replace(/y$/, 'i'));
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
  // Open English WordNet meanings show to students right away (her request 2026-11-19: "add definitions to all words");
  // a teacher can still mark one back to draft to hide it.
  const status: ReviewStatus = statusOf(`${s.id}:sense`, 'approved');
  const examples: Example[] = (s.ex ?? []).filter((t) => !isBlockedText(t)).map((text) => ({ text, formulaCode: formulaFor(text), time: timeOf(text), provenance: [OEWN], status }));
  const near = [...(s.syn ?? []), ...(s.sim ?? []), ...(s.hyp ?? [])].filter((w) => !isBlockedTerm(w));
  const nSyn = s.syn?.length ?? 0, nSim = s.sim?.length ?? 0;
  return {
    id: s.id, signpost: signpostFor(s), pos,
    definition: { value: s.def, provenance: [OEWN], status },
    explanation: { value: '', provenance: [], status: 'draft' },
    grammar: { patterns: [] },
    examples,
    synonyms: near.map((w, i) => {
      const band = indexWord(w)?.band ?? 5;
      // Same meaning 1, similar 0.7, a more specific word (sprint for run) 0.5.
      return { wordId: w, closeness: i < nSyn ? 1 : i < nSyn + nSim ? 0.7 : 0.5, tier: tierFor(band), frequencyBand: band };
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
  // What the word can be, from the grammar engine every tool uses (most common first).
  const jobs = jobsOfWord(word);
  if (!rw && !seed && !iw && !jobs.length) return null;

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
    // Her drafted thesaurus words come first.
    const drafted = (s.synonyms ?? []).filter((w) => !isBlockedTerm(w)).map((w) => { const band = indexWord(w)?.band ?? 5; return { wordId: w, closeness: 1, tier: tierFor(band), frequencyBand: band }; });
    sense.synonyms = [...drafted, ...sense.synonyms.filter((x) => !drafted.some((d) => d.wordId === x.wordId))];
    const opp = (s.antonyms ?? []).filter((w) => !isBlockedTerm(w)).map((w) => ({ wordId: w, type: 'either-or' as const }));
    sense.antonyms = [...opp, ...sense.antonyms.filter((x) => !opp.some((d) => d.wordId === x.wordId))];
    senses.push(sense);
  });
  for (const p of rw?.parts ?? []) for (const s of p.senses) if (!matched.has(s.id)) senses.push(oewnSense(word, p.pos, s));
  // Every word gets a meaning (her request 2026-11-19): a word form borrows its base word's meanings, a small grammar
  // word gets a plain meaning, and a word built from a known word gets a meaning from its parts.
  let formOf: WordEntry['formOf'];
  if (!senses.length) { const fb = await fallbackSenses(word); senses.push(...fb.senses); formOf = fb.formOf; }

  const [ph, pic] = await Promise.all([phonicsOf(word), pictureFor(word)]);
  if (pic) {
    // One picture for each part of speech it has a picture for (the noun picture on a noun meaning, the verb on a verb).
    const by = Object.entries(pic.by ?? { noun: pic.file });
    for (const [pos, file] of by) {
      if (!file) continue;
      const target = senses.find((x) => x.pos === pos && x.pictureable) ?? senses.find((x) => x.pos === pos) ?? (by.length === 1 ? senses[0] : undefined);
      if (target) { target.pictures = [{ assetId: file, provenance: [provenanceOf(file)] }]; target.pictureable = true; }
    }
  }

  const parts: PartOfSpeech[] = [];
  for (const t of jobs) { const p = WORDTYPE_POS[t]; if (p && !parts.includes(p)) parts.push(p); }
  for (const s of senses) if (!parts.includes(s.pos)) parts.push(s.pos);

  const main = senses[0]?.pos ?? parts[0];
  const irregular = rw?.parts.find((p) => p.pos === main)?.forms ?? [];
  const formsValue = main ? regularForms(word, main, irregular) : { irregular: false };
  const entryStatus = statusOf(`${word}:entry`, 'draft');
  const soundOut = seed?.soundOut ?? soundOutFromIpa(rw?.ipa);

  return {
    id: word, headword: word, lemma: formOf?.base ?? word, formOf, soundOut, ipa: rw?.ipa,
    capitalLetter: jobs[0] === 'propernoun',
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

// ---------- meanings for words WordNet does not list on their own ----------
function draftedSense(word: string, pos: PartOfSpeech, def: string, i: number): Sense {
  const id = `${word}#plain${i}`;
  return {
    id, signpost: def.split(/[;,(]/)[0].split(' ').slice(0, 4).join(' '), pos,
    definition: { value: def, provenance: [DRAFTED], status: statusOf(`${id}:sense`, 'approved') },
    explanation: { value: '', provenance: [], status: 'draft' }, grammar: { patterns: [] }, examples: [],
    synonyms: [], antonyms: [], pictures: [], pictureable: false, safetyRating: 'ok', family: [],
  };
}

type FormKind = 's' | 'ed' | 'ing' | 'er' | 'est' | 'plural' | 'form';
function baseCandidates(w: string): [string, FormKind][] {
  const out: [string, FormKind][] = [];
  const irr = irregularBase(w);
  if (irr) out.push([irr, 'form']);
  const add = (suf: string, rep: string, kind: FormKind) => { if (w.endsWith(suf) && w.length > suf.length + 1) out.push([w.slice(0, -suf.length) + rep, kind]); };
  add('women', 'woman', 'plural'); add('men', 'man', 'plural'); add('ves', 'f', 'plural'); add('ves', 'fe', 'plural');
  add('ies', 'y', 's'); add('es', '', 's'); add('s', '', 's');
  add('ied', 'y', 'ed'); add('ed', '', 'ed'); add('ed', 'e', 'ed'); add('d', '', 'ed');
  add('ing', '', 'ing'); add('ing', 'e', 'ing'); add('ying', 'ie', 'ing');
  add('ier', 'y', 'er'); add('iest', 'y', 'est'); add('er', '', 'er'); add('er', 'e', 'er'); add('est', '', 'est'); add('est', 'e', 'est');
  for (const [suf, kind] of [['ed', 'ed'], ['ing', 'ing'], ['er', 'er'], ['est', 'est']] as const) {
    const b = w.endsWith(suf) ? w.slice(0, -suf.length) : '';
    if (b.length > 2 && b[b.length - 1] === b[b.length - 2]) out.push([b.slice(0, -1), kind]);
  }
  return out;
}
const FORM_NOTE: Record<FormKind, string> = {
  s: 'more than one, or what he, she or it does', plural: 'more than one', ed: 'in the past', ing: 'the -ing form',
  er: 'more', est: 'the most', form: 'another form',
};
const FORM_POS: Record<FormKind, PartOfSpeech[]> = { s: ['noun', 'verb'], plural: ['noun'], ed: ['verb', 'adjective'], ing: ['verb', 'noun', 'adjective'], er: ['adjective', 'adverb'], est: ['adjective', 'adverb'], form: ['noun', 'verb', 'adjective', 'adverb'] };

// Words built from a known word: un-, re-, -ness, -less, -ful, -y, -able, -er (a person who), -ly.
const BUILT: { test: RegExp; base: (m: RegExpMatchArray) => string[]; pos: PartOfSpeech; def: (b: string) => string }[] = [
  { test: /^un(.{3,})$/, base: (m) => [m[1]], pos: 'adjective', def: (b) => `not ${b}` },
  { test: /^re(.{3,})$/, base: (m) => [m[1]], pos: 'verb', def: (b) => `to ${b} again` },
  { test: /^(.{3,})ness$/, base: (m) => [m[1], m[1].replace(/i$/, 'y')], pos: 'noun', def: (b) => `being ${b}` },
  { test: /^(.{3,})less$/, base: (m) => [m[1]], pos: 'adjective', def: (b) => `without ${b}` },
  { test: /^(.{3,})ful$/, base: (m) => [m[1], m[1].replace(/i$/, 'y')], pos: 'adjective', def: (b) => `full of ${b}` },
  { test: /^(.{3,})able$/, base: (m) => [m[1], `${m[1]}e`], pos: 'adjective', def: (b) => `able to be ${pastOf(b)}` },
  { test: /^(.{3,})ly$/, base: (m) => [m[1], m[1].replace(/i$/, 'y')], pos: 'adverb', def: (b) => `in a ${b} way` },
  { test: /^(.{3,}?)(\w)\2y$/, base: (m) => [m[1] + m[2]], pos: 'adjective', def: (b) => `like ${b}, or full of ${b}` },
  { test: /^(.{3,})y$/, base: (m) => [m[1], `${m[1]}e`], pos: 'adjective', def: (b) => `like ${b}, or full of ${b}` },
  { test: /^(.{3,})er$/, base: (m) => [m[1], `${m[1]}e`], pos: 'noun', def: (b) => `a person or thing that ${third(b)}` },
];

async function fallbackSenses(word: string): Promise<{ senses: Sense[]; formOf?: WordEntry['formOf'] }> {
  const closed = CLOSED_DEFS[word];
  if (closed) return { senses: closed.map(([pos, def], i) => draftedSense(word, pos, def, i)) };
  for (const [base, kind] of baseCandidates(word)) {
    if (base === word) continue;
    const rb = await rawWord(base);
    if (!rb?.parts.length) continue;
    const parts = rb.parts.filter((p) => FORM_POS[kind].includes(p.pos));
    const use = parts.length ? parts : rb.parts;
    const senses = use.flatMap((p) => p.senses.slice(0, 4).map((s) => ({ ...oewnSense(base, p.pos, s), id: `${word}~${s.id}` })));
    if (senses.length) return { senses, formOf: { base, note: FORM_NOTE[kind] } };
  }
  for (const b of BUILT) {
    const m = word.match(b.test);
    if (!m) continue;
    for (const base of b.base(m)) {
      if ((await rawWord(base))?.parts.length) return { senses: [draftedSense(word, b.pos, b.def(base), 0)], formOf: { base, note: 'made from' } };
    }
  }
  return { senses: [] };
}
