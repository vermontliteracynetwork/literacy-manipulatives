import type { FrequencyBand, PartOfSpeech, Tier } from './types';
import { tierFor } from './data';
import { typesOf } from '../wordTypes';
import { PREFIXES, SUFFIXES } from './morphology';
import { ROOTS } from './roots';
import { isBlockedTerm } from './safety';
import { SENTENCE_FORMULAS } from '../writer/formulas';

// The Word List Maker and Browse engine (build spec section 6 and 4.3). UI-free. The data comes from
// scripts/build-word-explorer-lists.py (public/word-explorer/lists.json).

export interface ListWord {
  word: string; band: FrequencyBand; tier: Tier; patterns: string[]; syllables: string[];
  topic: string; lex: string; picture: boolean; posCode: string;
}

// WordNet's topic files in plain words (spec block 7, Browse Topics).
const TOPIC: Record<string, string> = {
  'noun.animal': 'Animals', 'noun.food': 'Food', 'noun.plant': 'Plants', 'noun.body': 'Body', 'noun.person': 'People',
  'noun.location': 'Places', 'noun.artifact': 'Things people make', 'noun.feeling': 'Feelings', 'verb.emotion': 'Feelings',
  'noun.time': 'Time', 'noun.phenomenon': 'Nature and weather', 'verb.weather': 'Nature and weather', 'noun.object': 'Nature and weather',
  'noun.substance': 'Materials', 'noun.communication': 'Words and messages', 'verb.communication': 'Talking and telling',
  'noun.act': 'Actions', 'noun.event': 'Events', 'noun.quantity': 'Numbers and amounts', 'noun.shape': 'Shapes',
  'noun.group': 'Groups', 'verb.motion': 'Moving', 'verb.consumption': 'Eating and drinking', 'verb.perception': 'Senses',
  'verb.contact': 'Touching and making', 'verb.creation': 'Touching and making', 'verb.body': 'Body', 'verb.competition': 'Games and sports',
  'noun.cognition': 'Thinking', 'verb.cognition': 'Thinking', 'noun.possession': 'Money and owning', 'verb.possession': 'Money and owning',
  'verb.social': 'People together', 'adj.all': 'Describing words', 'adj.pert': 'Describing words', 'adj.ppl': 'Describing words',
  'adv.all': 'How, when and where words',
};
export const topicOf = (lex: string) => TOPIC[lex] ?? 'Other';

let words: ListWord[] = [];
let loading: Promise<ListWord[]> | null = null;
export function loadLists(): Promise<ListWord[]> {
  loading ??= fetch('/word-explorer/lists.json').then((r) => r.json()).then((d: { patterns: string[]; syllables: string[]; lex: string[]; words: [string, string, number, number[], number[], number, number][] }) => {
    words = d.words.filter(([w]) => !isBlockedTerm(w)).map(([word, posCode, band, g, sy, lx, pic]) => {
      const lex = lx >= 0 ? d.lex[lx] : '';
      return { word, posCode, band: band as FrequencyBand, tier: tierFor(band as FrequencyBand, lex), patterns: g.map((i) => d.patterns[i]), syllables: sy.map((i) => d.syllables[i]), lex, topic: topicOf(lex), picture: !!pic };
    });
    return words;
  }).catch(() => { loading = null; return []; });
  return loading;
}
export const listWords = () => words;
export const TOPICS = [...new Set(Object.values(TOPIC))].sort();

// ---------- the items each block checks (spec section 6) ----------
const POS_CODE: Record<string, PartOfSpeech> = { n: 'noun', v: 'verb', a: 'adjective', r: 'adverb' };
// The part of speech of every meaning (so "run" is a verb and a noun).
export function partsOf(w: ListWord): PartOfSpeech[] {
  const out = new Set<PartOfSpeech>([...w.posCode.toLowerCase()].map((c) => POS_CODE[c]).filter(Boolean));
  for (const t of typesOf(w.word)?.all ?? []) out.add(t === 'propernoun' ? 'noun' : t as PartOfSpeech);
  return [...out];
}
// Prefixes, suffixes and roots in the word, by spelling with a real base word left over (spec block 3).
const partCache = new Map<string, string[]>();
export function wordPartsOf(w: string, known: (x: string) => boolean): string[] {
  const hit = partCache.get(w);
  if (hit) return hit;
  const out: string[] = [];
  let stem = w;
  for (let round = 0; round < 2; round++) {
    const s = SUFFIXES.filter((x) => !['s', 'es'].includes(x.text) || round === 0).sort((a, b) => b.text.length - a.text.length)
      .find((x) => stem.endsWith(x.text) && stem.length - x.text.length >= 3 && [stem.slice(0, -x.text.length), `${stem.slice(0, -x.text.length)}e`, stem.slice(0, -x.text.length).replace(/i$/, 'y'), stem.slice(0, -x.text.length - 1)].some(known));
    if (!s) break;
    if (!out.includes(`suffix:${s.text}`)) out.push(`suffix:${s.text}`);
    const cut = stem.slice(0, -s.text.length);
    stem = [cut, `${cut}e`, cut.replace(/i$/, 'y'), cut.slice(0, -1)].find(known) ?? cut;
  }
  const p = PREFIXES.sort((a, b) => b.text.length - a.text.length).find((x) => stem.startsWith(x.text) && known(stem.slice(x.text.length)) && stem.length - x.text.length >= 3);
  if (p) out.push(`prefix:${p.text}`);
  for (const r of ROOTS) if (w.includes(r.text) && w !== r.text) out.push(`root:${r.text}`);
  partCache.set(w, out);
  return out;
}

// ---------- the exact rule (spec section 6) ----------
export type Mode = 'only' | 'must';
export type Match = 'any' | 'all';
export function passes(items: string[], sel: string[], mode: Mode, match: Match) {
  if (sel.length === 0) return true;                    // nothing picked: block off
  if (mode === 'only') return items.every((x) => sel.includes(x));
  if (match === 'all') return sel.every((x) => items.includes(x));
  return sel.some((x) => items.includes(x));
}

export interface Block { sel: string[]; mode: Mode; match: Match }
export interface Related { seed: string; senseId: string; synonyms: boolean; antonyms: boolean; words: string[] }
export interface Recipe {
  spelling: Block; syllables: Block; parts: Block; pos: Block;
  tier: string[]; band: string[]; topic: string[]; picture: boolean;
  related?: Related;
}
export const emptyBlock = (): Block => ({ sel: [], mode: 'only', match: 'any' });
export const emptyRecipe = (): Recipe => ({ spelling: emptyBlock(), syllables: emptyBlock(), parts: emptyBlock(), pos: emptyBlock(), tier: [], band: [], topic: [], picture: false });

// Words in her formula units' model sentences, for "Topic, unit or formula code" (spec block 7).
export const UNITS = [...new Set(SENTENCE_FORMULAS.map((f) => f.unit))];
const unitWords = new Map<string, Set<string>>();
function wordsOfUnit(unit: string): Set<string> {
  if (!unitWords.has(unit)) unitWords.set(unit, new Set(SENTENCE_FORMULAS.filter((f) => f.unit === unit).flatMap((f) => f.sentence.toLowerCase().match(/[a-z']+/g) ?? [])));
  return unitWords.get(unit)!;
}

// A word must pass every block (AND). Words with no letter-sound data cannot pass an active spelling or syllable
// block (the phonics engine flagged them, or does not have them yet).
export function runRecipe(r: Recipe, list = words): ListWord[] {
  const known = new Set(list.map((w) => w.word));
  const isKnown = (x: string) => known.has(x);
  const related = r.related && (r.related.synonyms || r.related.antonyms) ? new Set(r.related.words) : null;
  return list.filter((w) => {
    if (related && !related.has(w.word)) return false;
    if (r.spelling.sel.length && (!w.patterns.length || !passes(w.patterns, r.spelling.sel, r.spelling.mode, r.spelling.match))) return false;
    if (r.syllables.sel.length && (!w.syllables.length || !passes(w.syllables, r.syllables.sel, r.syllables.mode, r.syllables.match))) return false;
    if (r.pos.sel.length && !passes(partsOf(w), r.pos.sel, r.pos.mode, r.pos.match)) return false;
    if (r.tier.length && !r.tier.includes(String(w.tier))) return false;
    if (r.band.length && !r.band.includes(String(w.band))) return false;
    if (r.topic.length && !r.topic.some((t) => (t.startsWith('unit:') ? wordsOfUnit(t.slice(5)).has(w.word) : w.topic === t))) return false;
    if (r.picture && !w.picture) return false;
    if (r.parts.sel.length && !passes(wordPartsOf(w.word, isKnown), r.parts.sel, r.parts.mode, r.parts.match)) return false;
    return true;
  });
}

// Hint text under a block (spec section 6), by block and mode.
export function hintFor(kind: 'spelling' | 'syllables' | 'parts' | 'pos', b: Block): string {
  if (!b.sel.length) return 'Nothing picked, so this filter is off.';
  const thing = { spelling: 'letter-sound', syllables: 'syllable', parts: 'word part', pos: 'part of speech' }[kind];
  const things = { spelling: 'sounds', syllables: 'syllable types', parts: 'word parts', pos: 'parts of speech' }[kind];
  if (b.mode === 'only') {
    if (kind === 'pos') return 'Every meaning of a word must be a part of speech you picked. So "run" is not in a verb-only list, because it can also be a noun.';
    if (kind === 'parts') return 'Every prefix, suffix and root in a word must be one you picked.';
    return `Every ${thing} in a word must be one you picked.`;
  }
  return b.match === 'all' ? `Words need every one of the ${things} you picked. Others are okay too.` : `Words need at least one ${thing} you picked. Other ${things} are okay.`;
}

// Sorting a list (spec: by frequency, A to Z, or pattern).
export type SortBy = 'frequency' | 'az' | 'pattern';
export function sortWords(list: ListWord[], by: SortBy, firstPattern?: string): ListWord[] {
  const out = [...list];
  if (by === 'az') return out.sort((a, b) => a.word.localeCompare(b.word));
  if (by === 'pattern') return out.sort((a, b) => (a.patterns.find((p) => p === firstPattern) ? 0 : 1) - (b.patterns.find((p) => p === firstPattern) ? 0 : 1) || a.patterns.join().localeCompare(b.patterns.join()) || a.word.localeCompare(b.word));
  return out.sort((a, b) => a.band - b.band || a.word.length - b.word.length || a.word.localeCompare(b.word));
}

// ---------- saved lists ----------
export interface SavedList {
  id: string; name: string; recipe: Recipe; keepUpdating: boolean; words: string[];
  added: string[]; removed: string[]; sort: SortBy; updatedAt: string;
}
const KEY = 'wx-lists-v1';
export function readLists(): SavedList[] { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; } }
export function writeLists(l: SavedList[]) { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* not saved */ } }
// A saved list's words now: "Keep updating" reruns its recipe as the dictionary grows; a locked list keeps its words.
export function wordsOfList(l: SavedList): string[] {
  if (!l.keepUpdating) return l.words;
  const base = runRecipe(l.recipe).map((w) => w.word).filter((w) => !l.removed.includes(w));
  return [...base, ...l.added.filter((w) => !base.includes(w))];
}
