// Every sentence logged in Formula Search's Log Formulas tab (her request 2026-11-20), kept in this browser. The table
// reads each one with the grammar engine when it opens, so a sentence's formula follows the engine as it improves.
export interface Occurrence { sentence: string; source: string; kind: 'student' | 'public' | 'book'; at: string }
const KEY = 'lm-formula-occurrences-v1';
export function readOccurrences(): Occurrence[] { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; } }
function write(list: Occurrence[]) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* not saved */ } }
export function addOccurrences(add: Occurrence[]): Occurrence[] {
  const list = readOccurrences();
  for (const o of add) if (!list.some((x) => x.sentence === o.sentence && x.source === o.source)) list.push(o);
  write(list);
  return list;
}
export function removeOccurrence(o: Occurrence): Occurrence[] {
  const list = readOccurrences().filter((x) => !(x.sentence === o.sentence && x.source === o.source));
  write(list);
  return list;
}
