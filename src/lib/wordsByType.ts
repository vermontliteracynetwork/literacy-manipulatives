// Literacy Manipulatives' own word lists by grammar symbol, and word forms (Story Maker's word book and video). These
// are this app's, not the shared engine's: the engine (her Symbolic Grammar curriculum) only says what job a word does.
// Call loadEngine() first.
import { jobsOfWord, wordsRanked, baseOf, pastOf, third, ingOf, pluralOf, type SymbolWordClass } from 'symbolic-grammar-engine';
export { pluralOf, ingOf };
export { multiJobWords, JOB_RULES, jobRuleFor, PREPOSITION_LIST, type MultiJobWord, type JobRule } from 'symbolic-grammar-engine/src/jobRules';

const cache = new Map<string, string[]>();

/** Every word of one type in the word lists, A to Z. maxRank 0 = the most common words (about 4,000), up to 3. A noun
 *  is listed once (not its plural) and a verb once (its plain form: run, not runs or ran). */
export function wordsOfType(type: SymbolWordClass, maxRank = 0): string[] {
  const key = `${type}|${maxRank}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const out = new Set<string>();
  for (const w of wordsRanked(maxRank)) {
    if (!/^[a-z]+$/.test(w)) continue;
    if (!jobsOfWord(w).includes(type)) continue;
    if (type === 'noun' && w.endsWith('s') && jobsOfWord(w.slice(0, -1)).includes('noun')) continue;
    if (type === 'verb' && baseOf(w) !== w) continue;
    out.add(w);
  }
  const list = [...out].sort();
  if (list.length) cache.set(key, list);
  return list;
}

/** Every form of a verb from its plain form (the Symbolic Grammar Engine makes every word form: ran, hopped, cried). */
export function verbForms(base: string): { base: string; third: string; past: string; ing: string } {
  return { base, third: third(base), past: pastOf(base), ing: ingOf(base) };
}
