import type { SymbolWordClass } from './grammarSymbols';
import type { PatternWord } from './sentenceSearch';
import { wordJobs } from './sentenceSearch';
import { tagForCheck } from './writer/sentenceCheck';
import { jobsOf, type TaggedWord } from './writer/tagger';
import { commonDictionaryJobs, dictionaryJobs, isWord, loadWords, wordsReady } from './writer/spell';
import { loadWordTypes } from './wordTypes';

// THE grammar engine for every Literacy Manipulatives tool (her request 2026-11-13: "move everything onto the same
// engine"; "we need to have a strong logic behind our mark ups and grammar symbols that can run all programs").
// Every tool that gives a word its grammar symbol goes through here:
//   - a sentence, word by word in context: Write mode, Formula Search (both tabs), Word Explorer (formula codes, why
//     lines, past/present/future), the whiteboard (text box to symbols, Symbol Sentence search, Sentence Check);
//   - one word on its own (does this word fit this symbol's bubble? what can this word be?): the whiteboard's word
//     bubbles and Grammar Symbols search, Word Explorer's word page and the Word List Maker.
// Underneath: the tagger (src/lib/writer/tagger.ts) and its rules (sentenceCheck.ts fixReadings), the teacher's
// fixes (writer/corrections.ts), and one word list: WordNet parts of speech (public/writer/pos.json, most common first),
// her board's word lists and the closed word groups. Its checks: writer/engineTests.ts and engineCheck.ts.

export type { TaggedWord };

// Load the word lists every tool needs before reading (safe to call many times).
export function loadEngine(): Promise<void> {
  return Promise.all([loadWords(), loadWordTypes()]).then(() => undefined);
}
export const engineReady = () => wordsReady();

// ---------- a sentence ----------
// Each word of a sentence with its symbol, read in context (contractions carry their two jobs in `parts`).
export const readText = (text: string): TaggedWord[] => tagForCheck(text);
// The same as symbols (one per word), for the whiteboard.
export const symbolsFor = (text: string): PatternWord[] => readText(text).map((w) => ({ wordClass: w.wordClass, word: w.word }));

// ---------- one word ----------
const low = (w: string) => w.trim().toLowerCase().replace(/[’]/g, "'").replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '');
// Every job a word can do (most common first), as the engine sees it.
export function jobsOfWord(raw: string): SymbolWordClass[] {
  const w = low(raw);
  if (!w) return [];
  const order = [...(commonDictionaryJobs(w) ?? []), ...(dictionaryJobs(w) ?? []), ...jobsOf(w)];
  return [...new Set(order)];
}
// Is the word in any word list the engine has (null while the lists are still loading)?
export function isKnown(raw: string): boolean | null {
  const w = low(raw);
  if (!wordsReady()) return null;
  return isWord(w) || !!dictionaryJobs(w)?.length || wordJobs(w).size > 0;
}

const POSSESSIVE = /^(my|your|his|her|its|our|their)$/;
const NUMBER = /^(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|hundred|first|second|third|last)$/;
// Does a student's word do this job? It uses the word's common jobs (so "cat" is not a verb) and the things her
// symbols count under another name: a name is a noun too; my, their, a number or an 's word describes a noun;
// an -ing or -ed doing word can describe one ("the running water"). 'unknown' when no word list has the word.
export function fitsJob(raw: string, want: SymbolWordClass): 'yes' | 'no' | 'unknown' {
  const w = low(raw);
  if (!w) return 'unknown';
  if (want === 'propernoun') return /^[A-Z]/.test(raw.trim()) ? 'yes' : isKnown(raw) ? 'no' : 'unknown';
  if (!isKnown(raw)) return 'unknown';
  const common = new Set<SymbolWordClass>([...(commonDictionaryJobs(w) ?? []), ...wordJobs(w)]);
  // Closed word groups (the, my, and, in...) from the tagger, without WordNet's rare uses.
  for (const j of jobsOf(w)) if (!(dictionaryJobs(w) ?? []).includes(j)) common.add(j);
  if (!common.size) for (const j of jobsOf(w)) common.add(j);
  if (common.has(want)) return 'yes';
  if (want === 'noun' && common.has('propernoun')) return 'yes';
  // An action word can name a thing too: "a jump", "a swim" (WordNet lists it as a noun).
  if (want === 'noun' && (dictionaryJobs(w) ?? []).includes('noun')) return 'yes';
  if (want === 'adjective' && (POSSESSIVE.test(w) || NUMBER.test(w) || /'s?$/.test(w) || (/(ing|ed|en)$/.test(w) && common.has('verb')))) return 'yes';
  if (want === 'pronoun' && POSSESSIVE.test(w)) return 'yes';
  return 'no';
}
// What a word that does not fit looks like instead (its most common job).
export const mainJob = (raw: string): SymbolWordClass | undefined => jobsOfWord(raw)[0];

// ---------- why a word got its symbol, in plain words (Word Explorer) ----------
export const TYPE_NAME: Record<SymbolWordClass, string> = {
  article: 'an article', adjective: 'an adjective', noun: 'a noun', propernoun: 'a proper noun', verb: 'a verb', adverb: 'an adverb',
  pronoun: 'a pronoun', preposition: 'a preposition', conjunction: 'a conjunction', interjection: 'an interjection',
};
const BE = /^(am|is|are|was|were|be|been|being|feel|feels|felt|seem|seems|seemed|look|looks|looked|become|becomes|became|turned|turns|stay|stays|stayed|sound|sounds|smell|smells|taste|tastes|get|gets|got|grew|grow|grows)$/;
const HELPER = /^(will|would|can|could|should|may|might|must|shall|do|does|did|to)$/;
const DETERMINER = /^(a|an|the|my|your|his|her|its|our|their|this|that|these|those|\d+|two|three|four|five|six|seven|eight|nine|ten)$/;

export interface WordReading { word: string; type: SymbolWordClass; why: string }
// Each word of a sentence with its symbol and the reason, from the engine's own reading.
export function readWithWhy(text: string): WordReading[] {
  const words = readText(text);
  return words.map((w, i) => {
    const t = w.wordClass;
    const me = `'${w.word}'`;
    const prev = words[i - 1], next = words[i + 1];
    const before = prev ? `'${prev.word}'` : '', after = next ? `'${next.word}'` : '';
    const lp = prev?.word.toLowerCase() ?? '';
    let why = '';
    const jobs = jobsOfWord(w.word);
    if (t === 'propernoun' && i > 0) why = `${me} starts with a capital letter in the middle of the sentence, so it is a proper noun.`;
    else if (jobs.length === 1 && jobs[0] === t && t !== 'noun' && t !== 'verb') why = `${me} is always ${TYPE_NAME[t]}.`;
    else if (t === 'adjective' && prev && (BE.test(lp) || prev.parts?.includes('verb'))) why = `${before} comes before ${me}, so ${me} describes the subject and is an adjective.`;
    else if (t === 'adjective' && next && ['noun', 'propernoun'].includes(next.wordClass)) why = `${me} comes before ${after} and describes it, so it is an adjective.`;
    else if (t === 'noun' && prev && (DETERMINER.test(lp) || prev.wordClass === 'adjective' || prev.wordClass === 'preposition')) why = `${before} comes before ${me}, so ${me} is a noun.`;
    else if (t === 'noun' && prev?.wordClass === 'verb') why = `${me} comes after the verb ${before} and names a thing, so it is a noun.`;
    else if (t === 'verb' && prev && (['noun', 'propernoun', 'pronoun'].includes(prev.wordClass) || HELPER.test(lp))) why = `${before} comes before ${me}, so ${me} is a verb.`;
    else if (t === 'verb' && i === 0) why = `${me} starts the sentence and tells someone what to do, so it is a verb.`;
    else if (t === 'adverb' && prev?.wordClass === 'verb') why = `${me} comes after the verb ${before} and tells how, when or where, so it is an adverb.`;
    else if (t === 'adverb') why = `${me} tells how, when or where, so it is an adverb.`;
    else if (t === 'preposition' && next) { const n = words.slice(i + 1).find((x) => ['noun', 'propernoun', 'pronoun'].includes(x.wordClass)); why = `${me} points to ${n ? `'${n.word}'` : after}, so it is a preposition.`; }
    else if (t === 'conjunction') why = `${me} joins two parts of the sentence, so it is a conjunction.`;
    else why = `${me} is ${TYPE_NAME[t]} here.`;
    return { word: w.word, type: t, why };
  });
}
