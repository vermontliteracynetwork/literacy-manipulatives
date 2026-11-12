import data from './phonicsPatterns.json';
import type { SyllableType } from './types';

// Letter-sound tiles, syllables and pattern lists for the Sounds tab (build spec section 7). The alignment itself is
// done ahead of time by scripts/build-word-explorer-phonics.py (CMU Pronouncing Dictionary). UI-free.

export interface Pattern { id: string; letters: string; sound: string; group: string; name?: string; ex?: string; extra?: boolean; tagOnly?: boolean }
export interface SoundInfo { show: string; label?: string; ex?: string }
export const PATTERNS = data.patterns as Pattern[];
export const PATTERN_BY_ID = new Map(PATTERNS.map((p) => [p.id, p]));
export const SOUNDS = data.sounds as Record<string, SoundInfo>;
export const PATTERN_GROUPS = [...new Set(PATTERNS.map((p) => p.group))];

export interface Grapheme { letters: string; sound: string; patternId: string }
export interface WordPhonics { graphemes: Grapheme[]; syllables: { text: string; type: SyllableType }[]; uncertain: boolean }

// "/ā/ (long a ex. cake)", "/r/", "/th/ (voiced ex. this)". Sound keys the list doesn't name show as written.
export function soundLabel(sound: string): string {
  if (!sound) return 'silent';
  const s = SOUNDS[sound];
  if (!s) return sound.split(' ').map((x) => SOUNDS[x]?.show ?? `/${x}/`).join(' ');
  return s.label ? `${s.show} (${s.label} ex. ${s.ex})` : s.show;
}
// The tile text: "ai /ā/ (long a ex. cake)", "r /r/".
export const tileLabel = (g: Grapheme) => `${g.letters} ${soundLabel(g.sound)}`;
// A pattern's name in lists: "ai /ā/ (long a ex. cake)", "consonant + le".
export function patternLabel(p: Pattern): string {
  if (p.name) return p.ex ? `${p.name} (ex. ${p.ex})` : p.name;
  return `${p.letters} ${soundLabel(p.sound)}${p.ex ? ` (ex. ${p.ex})` : ''}`;
}

// What read aloud says for a tile (a device voice cannot say a sound by itself, so it names it and gives a word).
const SAY: Record<string, string> = {
  'ă': 'short a', 'ĕ': 'short e', 'ĭ': 'short i', 'ŏ': 'short o', 'ŭ': 'short u', 'ā': 'long a', 'ē': 'long e', 'ī': 'long i', 'ō': 'long o',
  'ū': 'oo', 'yū': 'you', 'oo': 'oo, as in book', aw: 'aw', oi: 'oy', ow: 'ow', er: 'er', ar: 'ar', or: 'or', air: 'air', ear: 'ear', 'ə': 'uh',
};
export function tileSpeech(g: Grapheme, word: string): string {
  const letters = g.letters.replace('_', ' blank ').split('').join(' ').replace(/ +/g, ' ');
  if (!g.sound) return `${letters}, silent, in ${word}`;
  const sound = SAY[g.sound] ?? SOUNDS[g.sound]?.ex ?? g.sound;
  return SAY[g.sound] ? `${letters}, ${sound}, as in ${word}` : `${letters}, as in ${word}`;
}

const shards = new Map<string, Promise<Record<string, { g: [string, string, string][]; s: [string, SyllableType][]; u?: 1 }>>>();
const shardKey = (w: string) => (`${w}_`).slice(0, 2).replace(/[^a-z]/g, '_');
export async function phonicsOf(word: string): Promise<WordPhonics | null> {
  const k = shardKey(word);
  if (!shards.has(k)) shards.set(k, fetch(`/word-explorer/phonics/${k}.json`).then((r) => (r.ok ? r.json() : {})).catch(() => { shards.delete(k); return {}; }));
  const rec = (await shards.get(k)!)[word];
  if (!rec) return null;
  return {
    graphemes: rec.g.map(([letters, sound, patternId]) => ({ letters, sound, patternId })),
    syllables: rec.s.map(([text, type]) => ({ text, type })),
    uncertain: !!rec.u,
  };
}

// Pattern tags for a word: every grapheme's pattern, plus nasalized a (am, an) when it is there.
export function patternTags(p: WordPhonics): string[] {
  const tags = p.graphemes.map((g) => g.patternId);
  p.graphemes.forEach((g, i) => { const n = p.graphemes[i + 1]?.letters; if (g.patternId === 'a-short' && (n === 'm' || n === 'n')) tags.push(n === 'm' ? 'am' : 'an'); });
  return [...new Set(tags)].filter((t) => t !== 'other');
}

let patternWords: Promise<Record<string, string[]>> | null = null;
export function wordsWithPattern(id: string): Promise<string[]> {
  patternWords ??= fetch('/word-explorer/patterns.json').then((r) => (r.ok ? r.json() : {})).catch(() => { patternWords = null; return {}; });
  return patternWords.then((m) => m[id] ?? []);
}
// Other spellings of the same sound ("all spellings of /ā/").
export const spellingsOfSound = (sound: string) => PATTERNS.filter((p) => p.sound === sound && !p.tagOnly && p.id !== 'other');

export const SYLLABLE_TYPE_NOTES: Record<SyllableType, string> = {
  closed: 'A closed syllable ends with a consonant, so the vowel is short (cat).',
  open: 'An open syllable ends with a vowel, so the vowel is often long (go).',
  'silent e': 'A silent e syllable has a vowel, a consonant and a silent e (cake).',
  'vowel team': 'A vowel team syllable has letters that work together for one vowel sound (rain).',
  'r-controlled': 'An r-controlled syllable has a vowel followed by r (car).',
  'consonant-le': 'A consonant-le syllable is a consonant and le at the end of a word (table).',
  diphthong: 'A diphthong syllable has a vowel sound that glides (coin).',
};
