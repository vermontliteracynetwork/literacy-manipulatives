import { fitsJob, type SymbolWordClass } from 'symbolic-grammar-engine';
import { tagForCheck } from '../writer/sentenceCheck';
import { baseOf, pastOf } from '../writer/tenses';
import type { BlankCounts, BlankKind } from './stories';

// Picks a Silly Story's blanks with the Symbolic Grammar Engine: it reads the whole story, finds the words doing each
// job (a noun, a verb, an adjective...), and takes the number of each that the teacher set, spread through the story,
// in an order fixed by the story's "seed" (New random words changes it). The blanks are worked out on the teacher's
// screen and saved with the story, so every student gets the same blanks.

export interface Blank { t: number; kind: BlankKind; label: string; cls: SymbolWordClass; was: string }

export const KIND_CLASS: Record<BlankKind, SymbolWordClass> = { noun: 'noun', pluralNoun: 'noun', verb: 'verb', adjective: 'adjective', adverb: 'adverb', number: 'adjective' };
export const KIND_NAME: Record<BlankKind, string> = { noun: 'Nouns', pluralNoun: 'Plural nouns', verb: 'Verbs', adjective: 'Adjectives', adverb: 'Adverbs', number: 'Numbers' };
export const KINDS: BlankKind[] = ['noun', 'pluralNoun', 'verb', 'adjective', 'adverb', 'number'];

/** The story cut into pieces: words (even indexes are never words) and the spaces and marks between them. */
export const tokens = (text: string): string[] => text.split(/(\[[a-zA-Z ]+\]|[A-Za-z][A-Za-z']*|\d+)/);
const isWordTok = (t: string) => /^([A-Za-z]|\d|\[)/.test(t);

const NUMBER_WORDS = new Set(['two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'twenty', 'hundred', 'thousand']);
const DET = new Set(['a', 'an', 'the', 'my', 'his', 'her', 'their', 'our', 'your', 'its', 'this', 'that', 'these', 'those', 'some', 'every', 'each', 'no', 'any']);
const SKIP = new Set(['is', 'are', 'was', 'were', 'be', 'been', 'am', 'do', 'did', 'does', 'had', 'has', 'have', 'got', 'get', 'could', 'can', 'will', 'would', 'should', 'there', 'then', 'very', 'so', 'too', 'not', 'just', 'ever', 'even', 'next', 'first', 'right', 'away', 'out', 'back', 'up', 'down', 'over', 'together', 'inside', 'time', 'thing', 'day', 'way', 'one', 'own', 'same', 'whole', 'each', 'every', 'other', 'another', 'all', 'some', 'more', 'most', 'little', 'much', 'many', 'sure', 'said', 'went', 'came', 'made', 'took', 'saw', 'let']);

function seeded(seed: string) { let h = 2166136261; for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function labelFor(kind: BlankKind, w: string): string {
  const lw = w.toLowerCase();
  if (kind === 'verb') {
    if (lw.endsWith('ing')) return 'a verb ending in -ing';
    const b = baseOf(lw);
    if (b !== lw && pastOf(b) === lw) return 'a verb in the past';
    if (lw.endsWith('ed')) return 'a verb in the past';
    if (/[^s]s$/.test(lw) && b !== lw) return 'a verb ending in -s';
    return 'a verb';
  }
  return { noun: 'a noun', pluralNoun: 'a plural noun (more than one)', adjective: 'an adjective', adverb: 'an adverb', number: 'a number' }[kind];
}

const BRACKET: Record<string, BlankKind> = { noun: 'noun', 'plural noun': 'pluralNoun', plural: 'pluralNoun', verb: 'verb', adjective: 'adjective', adverb: 'adverb', number: 'number' };

export function pickBlanks(text: string, counts: BlankCounts, seed: string): Blank[] {
  const toks = tokens(text);
  const words = toks.map((t, i) => ({ t, i })).filter((x) => isWordTok(x.t));
  const out: Blank[] = [];
  // Words in brackets are always blanks.
  for (const { t, i } of words) {
    const m = /^\[([a-zA-Z ]+)\]$/.exec(t);
    if (m) { const kind = BRACKET[m[1].toLowerCase()] ?? 'noun'; out.push({ t: i, kind, label: labelFor(kind, ''), cls: KIND_CLASS[kind], was: '' }); }
  }
  // The engine's job for each word, read in its sentence.
  let tagged: { word: string; wordClass: SymbolWordClass }[] = [];
  try { tagged = tagForCheck(text.replace(/\[[a-zA-Z ]+\]/g, 'thing')); } catch { tagged = []; }
  const jobOf = new Map<number, SymbolWordClass>();
  let k = 0;
  for (const { t, i } of words) {
    const lw = t.toLowerCase();
    for (let look = k; look < Math.min(tagged.length, k + 4); look++) {
      if (tagged[look].word.toLowerCase() === lw) { jobOf.set(i, tagged[look].wordClass); k = look + 1; break; }
    }
  }
  const taken = new Set(out.map((b) => b.t));
  const pools: Record<BlankKind, number[]> = { noun: [], pluralNoun: [], verb: [], adjective: [], adverb: [], number: [] };
  for (const { t, i } of words) {
    if (taken.has(i) || t.startsWith('[')) continue;
    const lw = t.toLowerCase();
    if (/^\d+$/.test(t) || NUMBER_WORDS.has(lw)) { pools.number.push(i); continue; }
    if (t[0] !== t[0].toLowerCase() || lw.length < 3 || SKIP.has(lw) || lw.includes("'")) continue;
    const job = jobOf.get(i);
    if (!job || fitsJob(lw, job) !== 'yes') continue;
    if (job === 'noun') {
      // A noun blank needs a noun signal before it (the, a, my, a describing word...), so "cannot wait" or "dove into"
      // never become a noun blank.
      const prev = (toks[i - 2] ?? '').toLowerCase();
      const prevJob = jobOf.get(i - 2);
      if (!(DET.has(prev) || prevJob === 'adjective' || NUMBER_WORDS.has(prev) || /^\d+$/.test(prev))) continue;
      const one = lw.endsWith('es') && fitsJob(lw.slice(0, -2), 'noun') === 'yes' ? lw.slice(0, -2) : lw.endsWith('s') ? lw.slice(0, -1) : '';
      const plural = !!one && !/(us|ss|is)$/.test(lw) && fitsJob(one, 'noun') === 'yes';
      (plural ? pools.pluralNoun : pools.noun).push(i);
    }
    else if (job === 'verb') {
      const prev = (toks[i - 2] ?? '').toLowerCase();
      if (DET.has(prev) || NUMBER_WORDS.has(prev) || jobOf.get(i - 2) === 'adjective') continue;
      if (jobOf.get(i - 2) === 'noun' && jobOf.get(i + 2) === 'verb') continue; // "sea turtles floated": a noun, not a verb
      pools.verb.push(i);
    }
    else if (job === 'adjective') pools.adjective.push(i);
    else if (job === 'adverb' && lw.endsWith('ly')) pools.adverb.push(i);
  }
  const r = seeded(seed);
  for (const kind of KINDS) {
    const want = Math.max(0, counts[kind] ?? 0);
    const pool = pools[kind].filter((i) => !taken.has(i) && !taken.has(i - 2) && !taken.has(i + 2));
    for (let n = 0; n < want && pool.length; n++) {
      const at = Math.floor(r() * pool.length);
      const i = pool.splice(at, 1)[0];
      if (taken.has(i - 2) || taken.has(i + 2)) { n--; continue; } // never two blanks side by side
      taken.add(i);
      out.push({ t: i, kind, label: labelFor(kind, toks[i]), cls: KIND_CLASS[kind], was: toks[i] });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

/** How many of each kind the story has room for (shown beside each setting). */
export function available(text: string): Record<BlankKind, number> {
  const n: Record<BlankKind, number> = { noun: 0, pluralNoun: 0, verb: 0, adjective: 0, adverb: 0, number: 0 };
  for (const k of KINDS) n[k] = pickBlanks(text, { [k]: 99 }, 'count').filter((x) => x.was && x.kind === k).length;
  return n;
}

/** The story with the student's words in it. */
export function fillStory(text: string, blanks: Blank[], words: Record<string, string>): { text: string; mine: boolean }[] {
  const toks = tokens(text);
  const at = new Map(blanks.map((b, n) => [b.t, n]));
  return toks.map((t, i) => (at.has(i) ? { text: words[at.get(i)!]?.trim() || '_____', mine: true } : { text: t, mine: false }));
}
