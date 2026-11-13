import type { SymbolWordClass } from '../grammarSymbols';
import type { TaggedWord } from './tagger';

// Teacher corrections to the grammar engine (Formula Search's passage tab, her request 2026-11-13: "increase the accuracy of the
// logic behind our symbolic grammar program"). When the engine gives a word the wrong part of speech in a real
// sentence, the teacher picks the right one. Each correction is kept with the words around it, and the engine uses
// it from then on (sentenceCheck.tagForCheck, so Write mode, Formula Search, Word Explorer and the passage tab
// all improve):
//   1. the same sentence: always;
//   2. the same word with the same word before it, or the same word after it ("the run" / "a run");
//   3. the same word everywhere, once at least two corrections agree and none disagree.
// Every corrected sentence is also a test: the passage tab shows how often the engine gets them right.

export interface Correction { word: string; prev: string; next: string; to: SymbolWordClass; from: SymbolWordClass; sentence: string; at: string }
const KEY = 'lm-pos-corrections-v1';
let list: Correction[] = read();
let version = 0;
function read(): Correction[] { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; } }
function write(next: Correction[]) {
  list = next; version++;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* not saved */ }
}
// Fixes shared with every project (the engine's data/teacher-fixes.json), under this browser's own fixes.
let shared: Correction[] = [];
export function setSharedCorrections(fixes: Correction[]) { shared = Array.isArray(fixes) ? fixes : []; version++; }
export const sharedCorrections = () => shared;
// This browser's own fixes (the ones a teacher can undo or send to be shared).
export const corrections = () => list;
const allFixes = () => (shared.length ? [...shared, ...list] : list);
export const correctionsVersion = () => version;
const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
const low = (w?: string) => (w ?? '').toLowerCase().replace(/[’]/g, "'");

export function addCorrection(words: TaggedWord[], index: number, to: SymbolWordClass, sentence: string, from: SymbolWordClass) {
  const c: Correction = { word: low(words[index].word), prev: low(words[index - 1]?.word), next: low(words[index + 1]?.word), to, from, sentence: norm(sentence), at: new Date().toISOString().slice(0, 10) };
  write([...list.filter((x) => !(x.sentence === c.sentence && x.word === c.word && x.prev === c.prev && x.next === c.next)), c]);
}
export function removeCorrection(c: Correction) { write(list.filter((x) => x !== c)); }
export function replaceCorrections(next: Correction[]) { write(next); }

// The engine's answer changed by the corrections it has (leave out one sentence to test how well it learned).
export function applyCorrections(words: TaggedWord[], text: string, from: Correction[] = allFixes(), skipSentence?: string): TaggedWord[] {
  if (!from.length) return words;
  const sent = norm(text);
  const pool = skipSentence ? from.filter((c) => c.sentence !== skipSentence) : from;
  return words.map((w, i) => {
    if (w.parts) return w; // contractions keep their two jobs
    const word = low(w.word), prev = low(words[i - 1]?.word), next = low(words[i + 1]?.word);
    const mine = pool.filter((c) => c.word === word);
    if (!mine.length) return w;
    const exact = mine.find((c) => c.sentence === sent && c.prev === prev && c.next === next);
    const near = mine.find((c) => c.prev === prev && prev) ?? mine.find((c) => c.next === next && next);
    const agree = mine.length >= 2 && mine.every((c) => c.to === mine[0].to) ? mine[0] : undefined;
    const pick = exact ?? near ?? agree;
    return pick && pick.to !== w.wordClass ? { ...w, wordClass: pick.to } : w;
  });
}

// How accurate the engine is on the corrected words: alone, and with what it learned from the other sentences.
export function accuracy(tag: (text: string) => TaggedWord[]): { total: number; alone: number; learned: number } {
  let alone = 0, learned = 0;
  const every = allFixes();
  for (const c of every) {
    const raw = tag(c.sentence);
    const i = raw.findIndex((w, k) => low(w.word) === c.word && low(raw[k - 1]?.word) === c.prev && low(raw[k + 1]?.word) === c.next);
    if (i < 0) continue;
    if (raw[i].wordClass === c.to) alone++;
    if (applyCorrections(raw, c.sentence, every, c.sentence)[i].wordClass === c.to) learned++;
  }
  return { total: every.length, alone, learned };
}
