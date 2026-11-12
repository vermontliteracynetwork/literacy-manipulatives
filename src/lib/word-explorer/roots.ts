import { ALL_MORPHEMES, type Morpheme } from '../morphemes';
import { allWords } from './data';
import type { Provenance } from './types';

// Greek and Latin roots for the Word Parts tab (build spec section 8). The forms and meanings are her "111 Roots,
// Suffixes, and Prefixes" list, already on the board as morpheme pieces (src/lib/morphemes.ts). Its example words
// and activities are not used here (author and license unknown). Origins are Word Explorer's drafts and stay
// hidden from students until a cited source is added and she approves them.

export const ROOT_LIST_SOURCE: Provenance = { source: 'Her "111 Roots, Suffixes, and Prefixes" list (author and license unknown)', license: 'Unknown, form and meaning only' };

// Draft origins (needs a cited source before students see them).
const GREEK = new Set('a anthro anti archea astro auto bibl bio cardio ceph chrom chron cosm cracy deca demo derma di dino dyna geo graph helio hexa hydro hyper lexi macro mania mega meter micro mono morpho nano neo olig ology omni onym ortho paleo pan path peri petr phil phile phobia phon phyto poli poly proto pseudo psych scope soph tele tetra theo therm toxi zo'.split(' '));
export const originOf = (m: Morpheme) => m.origin ?? (GREEK.has(m.text) ? 'Greek' : 'Latin');

// Spec section 8, known errors in the source list: words that look like they hold a root but don't.
const NOT_THIS_ROOT: Record<string, string[]> = {
  port: ['portcullis', 'portion', 'important', 'opportunity', 'porter', 'portrait', 'portal', 'sport', 'report'],
  petr: ['osteoporosis'],
  lumin: ['translucent'],
  ped: ['speed', 'stopped', 'shipped', 'tapped'],
  aud: ['fraud', 'applaud'],
  mem: ['member', 'them'],
  vac: ['vacation'],
};

export const ROOTS: Morpheme[] = ALL_MORPHEMES.filter((m) => m.kind === 'root' && m.text.length >= 3)
  .filter((m, i, list) => list.findIndex((x) => x.text === m.text) === i);

// The root of the week: the same for everyone in a given week, in the list's order.
export function rootOfWeek(date = new Date()): Morpheme {
  const week = Math.floor((date.getTime() - Date.UTC(2026, 0, 5)) / (7 * 86400000));
  return ROOTS[((week % ROOTS.length) + ROOTS.length) % ROOTS.length];
}

// Words that pass the structure check (the spelling holds the root). The meaning check needs a cited etymology,
// so each candidate stays a draft until she approves it.
// The root has to sit inside the word's stem, not run into an ending ("ling" is not in feel-ing).
const stemOf = (w: string) => {
  let s = w;
  for (let i = 0; i < 3; i++) s = s.replace(/(ing|ed|es|s|er|est|ly)$/, '');
  return s;
};
const holdsRoot = (w: string, root: string) => w !== root && stemOf(w).includes(root);
export function rootCandidates(root: Morpheme, limit = 12): string[] {
  const skip = new Set(NOT_THIS_ROOT[root.text] ?? []);
  return allWords()
    .filter((x) => x.hasEntry && x.band <= 4 && holdsRoot(x.word, root.text) && !skip.has(x.word))
    .sort((a, b) => a.band - b.band || a.word.length - b.word.length)
    .slice(0, limit)
    .map((x) => x.word);
}

// Roots this word's spelling holds (structure check only).
export const rootsIn = (word: string) => ROOTS.filter((r) => holdsRoot(word, r.text) && !(NOT_THIS_ROOT[r.text] ?? []).includes(word));
