// Real-world practice sentences for each formula code (Passage Builder, her request 2026-11-13): sentences from
// student writing or public domain passages that a teacher keeps as practice for that formula. Formula Search shows
// them under the formula. Kept in this browser; the Passage Builder can download and open them as a file.
export interface PracticeSentence { sentence: string; source: string; kind: 'student' | 'public'; at: string }
const KEY = 'lm-formula-practice-v1';
export function readPractice(): Record<string, PracticeSentence[]> { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; } }
export function writePractice(p: Record<string, PracticeSentence[]>) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* not saved */ } }
export function addPractice(code: string, s: PracticeSentence): Record<string, PracticeSentence[]> {
  const all = readPractice();
  const list = all[code] ?? [];
  if (!list.some((x) => x.sentence === s.sentence)) all[code] = [...list, s];
  writePractice(all);
  return all;
}
export function removePractice(code: string, sentence: string): Record<string, PracticeSentence[]> {
  const all = readPractice();
  all[code] = (all[code] ?? []).filter((x) => x.sentence !== sentence);
  if (!all[code].length) delete all[code];
  writePractice(all);
  return all;
}
