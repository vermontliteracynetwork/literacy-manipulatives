import { allWords, indexWord, irregularBase, type IndexWord } from './data';
import { isBlockedTerm } from './safety';

// Word Explorer search (spec Phase 1): autocomplete, base-word matching ("ran" finds run), contraction splitting
// ("don't" is do + not) and sound-alike spelling matches ("fone" finds phone). UI-free.

export const normalize = (q: string) => q.trim().toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z' -]/g, '').replace(/\s+/g, ' ');

// ---------- autocomplete ----------
function lowerBound(words: IndexWord[], prefix: string) {
  let lo = 0, hi = words.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (words[mid].word < prefix) lo = mid + 1; else hi = mid; }
  return lo;
}
export function autocomplete(q: string, limit = 8): string[] {
  const p = normalize(q);
  if (!p || isBlockedTerm(p)) return [];
  const words = allWords();
  const hits: IndexWord[] = [];
  for (let i = lowerBound(words, p); i < words.length && words[i].word.startsWith(p); i++) {
    if (words[i].hasEntry || words[i].pos) hits.push(words[i]);
  }
  hits.sort((a, b) => (a.word === p ? -1 : b.word === p ? 1 : a.band - b.band || a.word.length - b.word.length || (a.word < b.word ? -1 : 1)));
  return hits.slice(0, limit).map((x) => x.word);
}

// ---------- base words ----------
const known = (w: string) => !!indexWord(w);
export function baseWords(raw: string): string[] {
  const w = normalize(raw);
  const out: string[] = [];
  const add = (x: string | undefined) => { if (x && x !== w && known(x) && !out.includes(x)) out.push(x); };
  add(irregularBase(w));
  if (/ies$/.test(w)) add(`${w.slice(0, -3)}y`);
  if (/(ss|sh|ch|x|z|o)es$/.test(w)) add(w.slice(0, -2));
  if (/[^s]s$/.test(w)) add(w.slice(0, -1));
  for (const end of ['ed', 'ing', 'er', 'est']) {
    if (!w.endsWith(end) || w.length < end.length + 3) continue;
    const stem = w.slice(0, -end.length);
    if (/(.)\1$/.test(stem)) add(stem.slice(0, -1));          // hopped -> hop
    if (/i$/.test(stem)) add(`${stem.slice(0, -1)}y`);        // happier -> happy
    add(`${stem}e`);                                          // baked -> bake
    add(stem);                                                // jumped -> jump
  }
  if (/ly$/.test(w)) { add(w.slice(0, -2)); if (/ily$/.test(w)) add(`${w.slice(0, -3)}y`); }
  if (/'s$/.test(w)) add(w.slice(0, -2));
  return out;
}

// ---------- contractions ----------
const WHOLE: Record<string, string[]> = {
  "won't": ['will', 'not'], "can't": ['can', 'not'], "shan't": ['shall', 'not'], "let's": ['let', 'us'], "ain't": ['am', 'not'],
  "y'all": ['you', 'all'], "o'clock": ['of', 'the', 'clock'],
};
const ENDS: [string, string][] = [["n't", 'not'], ["'re", 'are'], ["'m", 'am'], ["'ve", 'have'], ["'ll", 'will'], ["'d", 'would'], ["'s", 'is']];
const S_PRONOUNS = new Set(['he', 'she', 'it', 'that', 'there', 'what', 'who', 'where', 'here', 'how', 'when', 'why']);
export function splitContraction(raw: string): string[] | null {
  const w = normalize(raw);
  if (WHOLE[w]) return WHOLE[w];
  for (const [end, full] of ENDS) {
    if (!w.endsWith(end) || w.length === end.length) continue;
    const first = w.slice(0, -end.length);
    if (end === "'s" && !S_PRONOUNS.has(first)) return null; // "dog's" is a possessive, not a contraction
    return [first, full];
  }
  return null;
}

// ---------- sound-alike spelling ----------
// A spelling squeezed to how it sounds: ph and gh as f, soft c as s, ck as k, silent e and doubled letters dropped.
export function soundSpelling(raw: string): string {
  let w = normalize(raw).replace(/[^a-z]/g, '');
  w = w.replace(/^kn/, 'n').replace(/^wr/, 'r').replace(/^gn/, 'n').replace(/^wh/, 'w').replace(/^ps/, 's').replace(/mb$/, 'm')
    .replace(/ph/g, 'f').replace(/gh$/, 'f').replace(/ght/g, 't').replace(/tch/g, 'ch').replace(/dge/g, 'j').replace(/ck/g, 'k')
    .replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k').replace(/q(u)?/g, 'kw').replace(/x/g, 'ks').replace(/z/g, 's')
    .replace(/g(?=[eiy])/g, 'j')
    .replace(/igh/g, 'i').replace(/(ai|ay|ei|ey|eigh)/g, 'a').replace(/(ee|ea|ie)/g, 'e').replace(/(oa|oe|ow)/g, 'o').replace(/(oo|ew|ue|ui)/g, 'u')
    .replace(/(.)\1+/g, '$1');
  if (w.length > 2) w = w.replace(/([^aeiou])e$/, '$1');
  return w;
}
const skeleton = (s: string) => s.replace(/[aeiouy]/g, '');

let soundIndex: Map<string, IndexWord[]> | null = null;
function bySkeleton(): Map<string, IndexWord[]> {
  if (soundIndex) return soundIndex;
  soundIndex = new Map();
  for (const x of allWords()) {
    if (!x.hasEntry && !x.pos) continue;
    const k = skeleton(soundSpelling(x.word));
    const list = soundIndex.get(k) ?? [];
    list.push(x);
    soundIndex.set(k, list);
  }
  return soundIndex;
}

export function editDistance(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]; d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length];
}

// Words that sound like what was typed, closest first.
export function soundAlikes(raw: string, limit = 6): string[] {
  const q = normalize(raw);
  if (!q || q.includes(' ')) return [];
  const qs = soundSpelling(q);
  const seen = new Map<string, number>();
  for (const x of bySkeleton().get(skeleton(qs)) ?? []) {
    if (x.word === q) continue;
    const dist = editDistance(qs, soundSpelling(x.word));
    if (dist <= 1) seen.set(x.word, dist * 10 + x.band);
  }
  // When some words sound exactly the same ("fone" and phone), offer only those.
  const ranked = [...seen].sort((a, b) => a[1] - b[1]);
  const same = ranked.filter(([, r]) => r < 10);
  return (same.length ? same : ranked).slice(0, limit).map(([w]) => w);
}

// Close spellings (one or two letters off), for typing slips.
export function spellingNear(raw: string, limit = 6): string[] {
  const q = normalize(raw);
  if (q.length < 3) return [];
  const max = q.length <= 4 ? 1 : 2;
  const hits: [string, number][] = [];
  for (const x of allWords()) {
    if (!x.hasEntry || Math.abs(x.word.length - q.length) > max || x.word === q) continue;
    if (x.word[0] !== q[0] && x.word[1] !== q[1]) continue;
    const d = editDistance(q, x.word);
    if (d <= max) hits.push([x.word, d * 10 + x.band]);
  }
  return hits.sort((a, b) => a[1] - b[1]).slice(0, limit).map(([w]) => w);
}

export interface SearchResult {
  query: string;
  exact?: string;              // the word itself has a page
  bases: string[];             // "ran" -> run
  contraction?: string[];      // "don't" -> do, not
  soundsLike: string[];        // "fone" -> phone
  spelledLike: string[];       // "hapy" -> happy
  blocked: boolean;
}

export function search(raw: string): SearchResult {
  const query = normalize(raw);
  const empty = { query, bases: [], soundsLike: [], spelledLike: [] };
  if (!query) return { ...empty, blocked: false };
  if (isBlockedTerm(query)) return { ...empty, blocked: true };
  const contraction = splitContraction(query) ?? undefined;
  const iw = indexWord(query);
  const bases = baseWords(query);
  // "ran" has no page of its own, so it goes to run; "running" (a noun too) keeps its own page.
  const exact = iw && (iw.hasEntry || !bases.length) ? query : undefined;
  const soundsLike = exact || contraction ? [] : soundAlikes(query).filter((w) => !bases.includes(w));
  const spelledLike = exact || contraction ? [] : spellingNear(query).filter((w) => !bases.includes(w) && !soundsLike.includes(w));
  return { query, exact, bases, contraction, soundsLike, spelledLike, blocked: false };
}
