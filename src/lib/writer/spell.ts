import { wordJobs } from '../sentenceSearch';
import type { MontessoriWordClass } from '../montessoriGrammar';
import { myWordClass } from './myWords';

// The Writer's spelling help (teacher, 2026-10-27): a dictionary of about 42,000 common English words
// (SCOWL lists, public/writer/words.json, ranked 0 = most common to 3 = less common), loaded only when the
// Writer opens. Misspellings are matched by sound the way young writers spell ("kach", "katch" -> catch) and
// by the words around them ("I will cat the ball" -> catch).

const RANK = new Map<string, number>();
const BY_KEY = new Map<string, string[]>();
const BY_SOUND_START = new Map<string, string[]>();
let loading: Promise<void> | null = null;

// The jobs a dictionary lists for each word, most common first (public/writer/pos.json, built from WordNet by
// scripts/build-pos.mjs): step 1 of choosing a word's symbol.
// Rare jobs (a capital letter in the file) are kept apart: the tagger may use them, spell check doesn't.
const POS = new Map<string, MontessoriWordClass[]>();
const COMMON_POS = new Map<string, MontessoriWordClass[]>();
const POS_CLASS: Record<string, MontessoriWordClass> = { n: 'noun', v: 'verb', a: 'adjective', r: 'adverb' };
export const dictionaryJobs = (raw: string): MontessoriWordClass[] | undefined => POS.get(raw.toLowerCase());
export const commonDictionaryJobs = (raw: string): MontessoriWordClass[] | undefined => COMMON_POS.get(raw.toLowerCase());

export function loadWords(): Promise<void> {
  loading ??= Promise.all([
    fetch('/writer/words.json').then((r) => r.json() as Promise<string[][]>),
    fetch('/writer/pos.json').then((r) => r.json() as Promise<Record<string, string>>).catch(() => ({} as Record<string, string>)),
  ])
    .then(([tiers, pos]) => {
      for (const [code, list] of Object.entries(pos)) {
        const classes = [...code].map((c) => POS_CLASS[c.toLowerCase()]).filter(Boolean);
        const common = [...code].filter((c) => c === c.toLowerCase()).map((c) => POS_CLASS[c]).filter(Boolean);
        for (const w of list.split(' ')) { POS.set(w, classes); COMMON_POS.set(w, common); }
      }
      tiers.forEach((list, rank) => {
        for (const w of list) {
          if (RANK.has(w)) continue;
          RANK.set(w, rank);
          const k = soundKey(w);
          if (!BY_KEY.has(k)) BY_KEY.set(k, []);
          BY_KEY.get(k)!.push(w);
          const s = k[0] ?? '';
          if (!BY_SOUND_START.has(s)) BY_SOUND_START.set(s, []);
          BY_SOUND_START.get(s)!.push(w);
        }
      });
    })
    .catch(() => { loading = null; });
  return loading;
}
export const wordsReady = () => RANK.size > 0;
// How common a word is (0 = most common), or undefined when the list doesn't have it.
export const wordRank = (raw: string) => RANK.get(raw.toLowerCase());

const CONTRACTIONS = new Set(["i'm", "i've", "i'll", "i'd", "you're", "you've", "you'll", "you'd", "he's", "she's", "it's", "we're", "we've", "we'll", "they're", "they've", "they'll", "that's", "there's", "what's", "who's", "let's", "don't", "doesn't", "didn't", "can't", "won't", "isn't", "aren't", "wasn't", "weren't", "couldn't", "shouldn't", "wouldn't", "haven't", "hasn't", "hadn't"]);

// Is this a real word? Unknown until the list has loaded (then nothing is marked wrong).
export function isWord(raw: string): boolean {
  if (myWordClass(raw)) return true;
  if (!wordsReady()) return true;
  const w = raw.toLowerCase();
  if (RANK.has(w) || CONTRACTIONS.has(w)) return true;
  if (w.endsWith("'s") && RANK.has(w.slice(0, -2))) return true;
  if (w.endsWith("s'") && RANK.has(w.slice(0, -1))) return true;
  return false;
}

// A spelling's "sound key": letters that young writers swap for the same sound map together, vowels count as
// one, doubled letters as one, and a silent final e drops off. kach, katch, cach and catch all become "kaX".
export function soundKey(raw: string): string {
  let s = raw.toLowerCase().replace(/[^a-z]/g, '');
  s = s.replace(/^kn/, 'n').replace(/^wr/, 'r').replace(/^wh/, 'w').replace(/^ps/, 's').replace(/^gn/, 'n');
  s = s.replace(/([^aeiou])e$/, '$1');
  s = s.replace(/tch/g, 'ch').replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/qu/g, 'kw').replace(/q/g, 'k')
    .replace(/dge/g, 'j').replace(/dg/g, 'j').replace(/gh/g, '')
    .replace(/c(?=[eiy])/g, 's').replace(/ch/g, 'X').replace(/sh/g, 'S').replace(/th/g, '0')
    .replace(/c/g, 'k').replace(/x/g, 'ks').replace(/z/g, 's').replace(/y$/, 'a');
  s = s.replace(/([a-zXS0])\1+/g, '$1').replace(/[aeiouy]+/g, 'a');
  return s;
}

// A finer sound key that keeps each vowel's sound, so "fether" (short e) matches feather, not father: vowel
// teams are read by the sound they usually make ("ea" before th, d or v is short e as in head; "ee" long e...).
function vowelSound(group: string, after: string): string {
  if (group === 'y') return 'I';
  if (group === 'ea') return /^(th|d|v|lth|lt|sur|thr)/.test(after) ? 'E' : 'I';
  if (['ee', 'ie', 'ei', 'ey'].includes(group)) return 'I';
  if (['ai', 'ay', 'eigh', 'ey'].includes(group) && group !== 'ey') return 'Y';
  if (['oa', 'oe'].includes(group)) return 'W';
  if (['oo', 'ew', 'ue', 'ui'].includes(group)) return 'U';
  if (['ou', 'ow'].includes(group)) return 'V';
  if (['oi', 'oy'].includes(group)) return 'Q';
  if (['au', 'aw'].includes(group)) return 'O';
  return group[0].toUpperCase();
}
export function fineKey(raw: string): string {
  let s = raw.toLowerCase().replace(/[^a-z]/g, '');
  s = s.replace(/^kn/, 'n').replace(/^wr/, 'r').replace(/^wh/, 'w').replace(/^ps/, 's').replace(/^gn/, 'n').replace(/^sch/, 'sk');
  // A silent e makes the vowel before it long: bote = boat, nite = night, cake.
  s = s.replace(/([aeiou])([^aeiouwy])e$/, (_, v: string, c: string) => ({ a: 'Y', e: 'I', i: 'J', o: 'W', u: 'U' } as Record<string, string>)[v] + c).replace(/([^aeiou])e$/, '$1');
  s = s.replace(/tch/g, 'ch').replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/qu/g, 'kw').replace(/dge?/g, 'j').replace(/igh/g, 'J')
    .replace(/c(?=[eiy])/g, 's').replace(/ch/g, 'X').replace(/sh/g, 'S').replace(/th/g, '0').replace(/c/g, 'k').replace(/x/g, 'ks').replace(/z/g, 's');
  s = s.replace(/([^aeiouy])\1+/g, '$1');
  return s.replace(/[aeiou]+[wy]?(?![aeiou])|(?<=[^aeiou])y/g, (g, at: number) => vowelSound(g, s.slice(at + g.length)));
}
// Is `a` inside `b` with only letters left out ("frend" in friend, "fether" in feather)? Leaving letters out
// is the most common spelling slip, so these words rank higher.
// Common misspellings of everyday words that don't sound the way they're spelled (said, was, because...), so
// the word the student almost certainly meant comes first.
const COMMON_MISSPELLINGS: Record<string, string> = {
  sed: 'said', sayed: 'said', wuz: 'was', woz: 'was', sum: 'some', thay: 'they', thai: 'they', becuz: 'because', becos: 'because', becaus: 'because', beacuse: 'because', becase: 'because',
  frum: 'from', fro: 'from', agen: 'again', agin: 'again', enuf: 'enough', enuff: 'enough', cud: 'could', coud: 'could', shud: 'should', shoud: 'should', wud: 'would', woud: 'would',
  sez: 'says', ses: 'says', dun: 'done', wun: 'one', wan: 'one', tow: 'two', tu: 'to', wer: 'were', whent: 'went', wont: "won't", dont: "don't", cant: "can't", didnt: "didn't",
  im: "I'm", ive: "I've", thier: 'their', freind: 'friend', frend: 'friend', frends: 'friends', peple: 'people', pepul: 'people', libary: 'library', becoz: 'because', alot: 'a lot',
  wich: 'which', whitch: 'which', wate: 'wait', wen: 'when', wat: 'what', wot: 'what', hav: 'have', luv: 'love', lik: 'like', liek: 'like', littel: 'little', pritty: 'pretty', prety: 'pretty',
  scool: 'school', skool: 'school', skul: 'school', tomoro: 'tomorrow', tommorow: 'tomorrow', tomorow: 'tomorrow', togeather: 'together', thru: 'through', untill: 'until',
  realy: 'really', reely: 'really', allways: 'always', alwas: 'always', evry: 'every', evrey: 'every', vary: 'very', verry: 'very', mabey: 'maybe', mabe: 'maybe', wanna: 'want to',
  gonna: 'going to', laffed: 'laughed', lafed: 'laughed', laft: 'laughed', ther: 'there', thare: 'there', whear: 'where', wher: 'where', bekuz: 'because', nite: 'night', rite: 'write',
};
export const commonFix = (typed: string) => COMMON_MISSPELLINGS[typed.toLowerCase()];
const lettersLeftOut = (a: string, b: string) => { let i = 0; for (const ch of b) if (ch === a[i]) i++; return i === a.length && b.length > a.length; };

function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

// What kind of word the spot calls for, from the word just before it.
// After will / can / to / don't the action is in its base form (catch, not caught or catches).
const BEFORE_BASE = new Set(['will', 'would', 'can', 'could', 'should', 'must', 'may', 'might', 'shall', 'to', 'do', 'does', 'did', "don't", "doesn't", "didn't", "can't", "won't", "let's", 'please']);
const BEFORE_VERB = new Set(['i', 'you', 'we', 'they', 'he', 'she', 'it']);
const IRREGULAR_PAST = new Set(['was', 'were', 'had', 'did', 'went', 'came', 'saw', 'got', 'made', 'took', 'gave', 'said', 'told', 'knew', 'thought', 'felt', 'ran', 'ate', 'drank', 'slept', 'sat', 'stood', 'swam', 'flew', 'wrote', 'drew', 'sang', 'rode', 'threw', 'caught', 'found', 'kept', 'built', 'brought', 'bought', 'sold', 'wore', 'held', 'hid', 'fell', 'grew', 'taught', 'won', 'lost', 'left', 'met', 'paid', 'sent', 'spent', 'woke', 'dug', 'fought', 'sank', 'shone', 'spun', 'swung', 'began', 'broke', 'chose', 'drove', 'forgot', 'heard', 'meant', 'spoke', 'stole', 'understood']);
const isBaseForm = (w: string) => !/(ed|ing)$/.test(w) && !IRREGULAR_PAST.has(w) && !(/[^s]s$/.test(w) && wordJobs(w.slice(0, -1)).has('verb'));
const BEFORE_NOUN = new Set(['a', 'an', 'the', 'my', 'your', 'his', 'her', 'our', 'their', 'this', 'that', 'these', 'those', 'some', 'every', 'each', 'many', 'its']);
export type Slot = 'base' | 'verb' | 'noun' | null;
export function slotAfter(prev: string | undefined): Slot {
  const p = (prev ?? '').toLowerCase();
  if (BEFORE_BASE.has(p)) return 'base';
  if (BEFORE_VERB.has(p)) return 'verb';
  if (BEFORE_NOUN.has(p)) return 'noun';
  return null;
}
const fitsSlot = (w: string, slot: Slot): boolean => {
  if (!slot) return true;
  const jobs = new Set([...wordJobs(w), ...(commonDictionaryJobs(w) ?? [])]);
  if (slot === 'base') return jobs.has('verb') && isBaseForm(w.toLowerCase());
  if (slot === 'verb') return jobs.has('verb');
  return jobs.has('noun') || jobs.has('adjective') || (!jobs.size && !/(ly|ed|ing)$/.test(w));
};
const knownJobsDontFit = (w: string, slot: Slot) => !!slot && wordJobs(w).size > 0 && !fitsSlot(w, slot);

export function debugRank(typed: string, prev?: string, next?: string[]) { return rank(typed, slotAfter(prev), 6, next); }
// Actions that go with everyday things, so the words after a spot help too ("cat the ball" -> catch).
const GOES_WITH: Record<string, string[]> = {
  ball: ['catch', 'throw', 'kick', 'hit', 'bounce', 'roll', 'pass'], book: ['read', 'write', 'open', 'close'],
  bike: ['ride'], horse: ['ride'], bus: ['ride', 'catch', 'take'], picture: ['draw', 'paint', 'take'], song: ['sing', 'play'],
  door: ['open', 'close', 'shut', 'lock'], water: ['drink', 'pour', 'splash'], milk: ['drink', 'pour'], juice: ['drink'],
  food: ['eat', 'cook', 'make'], cake: ['eat', 'bake', 'make'], pizza: ['eat', 'make'], apple: ['eat', 'pick'],
  fish: ['catch', 'feed'], dog: ['walk', 'feed', 'pet'], cat: ['feed', 'pet'], game: ['play', 'win', 'lose'],
  bed: ['make'], teeth: ['brush'], hair: ['brush', 'comb', 'cut'], hands: ['wash'], letter: ['write', 'send', 'read'],
  story: ['read', 'write', 'tell'], kite: ['fly'], tree: ['climb'], race: ['run', 'win'], car: ['drive', 'wash'],
};
const DETERMINERS = new Set(['a', 'an', 'the', 'my', 'your', 'his', 'her', 'our', 'their', 'this', 'that', 'some']);
const thingAfter = (next: string[] | undefined) => {
  const words = (next ?? []).map((w) => w.toLowerCase());
  const i = words[0] && DETERMINERS.has(words[0]) ? 1 : 0;
  return words[i] ?? '';
};
export interface Ranked { word: string; score: number; soundMatch: boolean; distance: number }
function rank(typed: string, slot: Slot, limit: number, next?: string[]): Ranked[] {
  const goesWith = new Set(GOES_WITH[thingAfter(next)] ?? []);
  const t = typed.toLowerCase();
  const key = soundKey(t);
  const fineT = fineKey(t);
  const realTyped = isWord(t);
  const pool = new Set<string>([...(BY_KEY.get(key) ?? [])]);
  for (const w of BY_SOUND_START.get(key[0] ?? '') ?? []) if (Math.abs(w.length - t.length) <= 2) pool.add(w);
  const out: Ranked[] = [];
  for (const w of pool) {
    if (w === t) continue;
    const distance = editDistance(t, w);
    const soundMatch = soundKey(w) === key;
    if (!soundMatch && distance > 2) continue;
    // The order suggestions come in (her request 2026-10-28: the most likely word first), each step weighed:
    //   1. Sounds the same, vowel sounds too (fine key: fether = feather) +4; same consonant sounds +3.
    //   2. Fits the sentence: the job the spot calls for (+2, or -1), and words that go with the next thing.
    //   3. Fewest changes: each change -1, but only leaving letters out is the most common slip (+1.5).
    //   4. Starts with the same letter (+0.5); for a real word, the longer word it starts (+2: "cat" -> catch).
    //   5. More common words first (+0.6 for each frequency tier).
    const sameSound = fineKey(w) === fineT;
    const nearSound = Math.max(0, 2 - editDistance(fineKey(w), fineT));
    let score = -distance + (sameSound ? 4 : soundMatch ? 3 : 0) + nearSound * 0.5 + (lettersLeftOut(t, w) ? 1.5 : 0) + (3 - (RANK.get(w) ?? 3)) * 0.6
      + (w[0] === t[0] ? 0.5 : 0) + (realTyped && w.length > t.length && w.startsWith(t) ? 2 : 0);
    if (slot) score += fitsSlot(w, slot) ? 1.5 : -0.5;
    if (goesWith.has(w)) score += 3;
    out.push({ word: w, score, soundMatch, distance });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

// Suggestions for a word that's misspelled, or real but wrong for its spot ("cat" after "will").
export function suggestFor(typed: string, prev?: string, limit = 4, next?: string[]): string[] {
  if (!wordsReady() || !/^[a-z']+$/i.test(typed)) return [];
  const slot = slotAfter(prev);
  if (isWord(typed) && !knownJobsDontFit(typed, slot)) return [];
  // 0. A known everyday misspelling goes first.
  const known = !isWord(typed) ? commonFix(typed) : undefined;
  const ranked = rank(typed, slot, limit, next).map((r) => r.word).filter((w) => w !== known);
  return (known ? [known, ...ranked] : ranked).slice(0, limit).map((w) => matchCase(typed, w));
}

// The one fix the Writer would make on its own, only when it's clearly the best guess.
export function confidentFix(typed: string, prev?: string, next?: string[]): string | null {
  if (!wordsReady() || !/^[a-z']+$/i.test(typed)) return null;
  const slot = slotAfter(prev);
  const misspelled = !isWord(typed);
  if (!misspelled && !knownJobsDontFit(typed, slot)) return null;
  if (misspelled && commonFix(typed)) return matchCase(typed, commonFix(typed)!);
  const top = rank(typed, slot, 2, next);
  if (!top.length) return null;
  const [a, b] = top;
  const clear = !b || a.score - b.score >= 1;
  const close = a.soundMatch || a.distance <= (misspelled ? 1 : 2);
  if (!misspelled && !(slot && fitsSlot(a.word, slot))) return null;
  return clear && close ? matchCase(typed, a.word) : null;
}

// Spell check "Common words only" (her answer 2026-10-28): a word is marked only when it's a misspelling of one
// of the ~4,000 most common words (tier 0), so younger writers aren't flooded with marks on harder words.
export function missesCommonWord(typed: string, prev?: string, next?: string[]): boolean {
  if (!wordsReady() || isWord(typed)) return false;
  const top = rank(typed, slotAfter(prev), 1, next)[0];
  return !!top && RANK.get(top.word) === 0 && (top.soundMatch || top.distance <= 2);
}

// Finishing the word being typed: common words that start the same way and fit the spot.
export function completionsFor(prefix: string, prev?: string, limit = 3): string[] {
  if (!wordsReady() || prefix.length < 2 || !/^[a-z']+$/i.test(prefix)) return [];
  const p = prefix.toLowerCase();
  const slot = slotAfter(prev);
  const out: { w: string; s: number }[] = [];
  for (const [w, r] of RANK) {
    if (w.length <= p.length || !w.startsWith(p)) continue;
    out.push({ w, s: (3 - r) * 2 + (slot && fitsSlot(w, slot) ? 2 : 0) - w.length * 0.05 });
  }
  return out.sort((a, b) => b.s - a.s).slice(0, limit).map((o) => matchCase(prefix, o.w));
}

const matchCase = (typed: string, w: string) => (/^[A-Z]/.test(typed) ? w.charAt(0).toUpperCase() + w.slice(1) : w);
export type { MontessoriWordClass };
