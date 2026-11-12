import type { WordEntry } from './types';
import { getEntry } from './data';
import { reviewKeys } from './review';
import { patternTags } from './phonics';
import { rootOfWeek } from './roots';
import type { WxSettings } from './settings';

// Word of the Day (build spec 4.1). Only Approved entries are eligible (the word facts approved and at least one
// meaning approved). The teacher picks one word for the class or one per student, where words come from (any,
// a Tier, a spelling pattern, or the root of the week), and how many days before a word can come back.
// Kept on this device until accounts exist: "one per student" gives each device its own word.

const HISTORY = 'wx-wotd-history-v1';
const DEVICE = 'wx-device-v1';
const today = () => new Date().toISOString().slice(0, 10);
const readHistory = (): { date: string; word: string }[] => { try { return JSON.parse(localStorage.getItem(HISTORY) ?? '[]'); } catch { return []; } };
function deviceSeed(): number {
  try {
    let id = localStorage.getItem(DEVICE);
    if (!id) { id = String(Math.floor(Math.random() * 1e9)); localStorage.setItem(DEVICE, id); }
    return Number(id);
  } catch { return 0; }
}
function hash(s: string): number { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

const approved = (e: WordEntry) => e.status === 'approved' && e.senses.some((s) => s.definition.status === 'approved');

async function fits(e: WordEntry, s: WxSettings): Promise<boolean> {
  if (!approved(e)) return false;
  if (s.wotdFrom === 'tier1') return e.tier.value === 1;
  if (s.wotdFrom === 'tier2') return e.tier.value === 2;
  if (s.wotdFrom === 'tier3') return e.tier.value === 3;
  if (s.wotdFrom === 'pattern') return !!e.phonics && patternTags({ graphemes: e.phonics.value.graphemes, syllables: e.phonics.value.syllables, uncertain: false }).includes(s.wotdPattern);
  if (s.wotdFrom === 'root') return e.headword.includes(rootOfWeek().text);
  return true;
}

export interface WordOfDay { entry: WordEntry | null; reason?: 'none-approved' | 'none-fit' }
export async function wordOfTheDay(s: WxSettings): Promise<WordOfDay> {
  const words = reviewKeys().filter((k) => k.endsWith(':entry')).map((k) => k.slice(0, -':entry'.length));
  const entries = (await Promise.all(words.map(getEntry))).filter((e): e is WordEntry => !!e);
  if (!entries.some(approved)) return { entry: null, reason: 'none-approved' };
  const pool: WordEntry[] = [];
  for (const e of entries) if (await fits(e, s)) pool.push(e);
  if (!pool.length) return { entry: null, reason: 'none-fit' };
  const history = readHistory();
  const kept = history.find((h) => h.date === today());
  if (kept) { const e = pool.find((x) => x.headword === kept.word); if (e) return { entry: e }; }
  const cutoff = new Date(Date.now() - s.wotdRepeatDays * 86400000).toISOString().slice(0, 10);
  const recent = new Set(history.filter((h) => h.date >= cutoff).map((h) => h.word));
  const fresh = pool.filter((e) => !recent.has(e.headword));
  const from = (fresh.length ? fresh : pool).sort((a, b) => a.headword.localeCompare(b.headword));
  const seed = hash(today() + (s.wotdFor === 'student' ? `:${deviceSeed()}` : ''));
  const pick = from[seed % from.length];
  try { localStorage.setItem(HISTORY, JSON.stringify([...history.filter((h) => h.date !== today()), { date: today(), word: pick.headword }].slice(-400))); } catch { /* not saved */ }
  return { entry: pick };
}

// A "Use it today" sentence frame for the word, by its part of speech.
export function sentenceFrame(word: string, pos: string): string {
  if (pos === 'verb') return `Today I will ${word} ________.`;
  if (pos === 'noun') return `I saw ${/^[aeiou]/.test(word) ? 'an' : 'a'} ${word} ________.`;
  if (pos === 'adverb') return `I ________ ${word} today.`;
  if (pos === 'adjective') return `Something ${word} I noticed today is ________.`;
  return `Today I used the word ${word} when ________.`;
}
