import type { MontessoriWordClass } from '../montessoriGrammar';

// My dictionary (her request 2026-10-28): words the Write mode doesn't know yet, like a name ("Xander"), that a
// student adds with the job the word does. Once added, spell check accepts the word and its symbol follows the
// job the student chose. Kept on this device.

export interface MyWord { word: string; cls: MontessoriWordClass }
const KEY = 'lm-my-words';
const read = (): MyWord[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; } };
let words: MyWord[] = read();
let byWord = new Map(words.map((w) => [w.word.toLowerCase(), w.cls]));
const listeners = new Set<() => void>();
let version = 0;

function save(next: MyWord[]) {
  words = next;
  byWord = new Map(words.map((w) => [w.word.toLowerCase(), w.cls]));
  version++;
  try { localStorage.setItem(KEY, JSON.stringify(words)); } catch { /* not remembered */ }
  listeners.forEach((f) => f());
}

export const myWords = () => words;
export const myWordsVersion = () => version;
export const subscribeMyWords = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const myWordClass = (raw: string): MontessoriWordClass | undefined => byWord.get(raw.toLowerCase().replace(/^'+|'+$/g, ''));
export function addMyWord(word: string, cls: MontessoriWordClass) {
  const w = word.trim().replace(/^'+|'+$/g, '');
  if (!w) return;
  save([...words.filter((x) => x.word.toLowerCase() !== w.toLowerCase()), { word: w, cls }].sort((a, b) => a.word.localeCompare(b.word)));
}
export function removeMyWord(word: string) { save(words.filter((x) => x.word.toLowerCase() !== word.toLowerCase())); }
