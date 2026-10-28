import { agreeWords, tagWordsPlain, wordJobs, type PatternWord } from '../sentenceSearch';
import type { MontessoriWordClass } from '../montessoriGrammar';
import { SENTENCE_FORMULAS, type SentenceFormula } from './formulas';

// The Writer's grammar check is her Sentence Check (Symbolic Grammar Program Overview, principle 9): every
// sentence, every time, five things: complete (a Who part and an Action), capital at the start (and on names
// and I), end mark, match (the Action matches one or many), and time (past, present or future, kept the same).
// The closest formula from her Sentence Formulas master list is shown as a model, never as a score.

export interface SentenceSpan { start: number; end: number; text: string; ended: boolean }

// Sentences in the text, each with where it starts and ends; `ended` when it has its end mark.
export function splitSentences(text: string): SentenceSpan[] {
  const out: SentenceSpan[] = [];
  const re = /[^.!?\n]*[A-Za-z][^.!?\n]*(?:[.!?]+["'”’)]*)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = m[0];
    const lead = raw.length - raw.trimStart().length;
    const t = raw.trim();
    if (!t) continue;
    out.push({ start: m.index + lead, end: m.index + lead + t.length, text: t, ended: /[.!?]["'”’)]*$/.test(t) });
  }
  return out;
}

export const CODE: Record<MontessoriWordClass, string> = {
  article: 'A', noun: 'N', propernoun: 'PN', pronoun: 'P', verb: 'V', adjective: 'Adj', adverb: 'Adv',
  preposition: 'Pr', conjunction: 'C', interjection: 'I',
} as Record<MontessoriWordClass, string>;

const IRREGULAR_PAST = new Set(['was', 'were', 'had', 'did', 'went', 'came', 'saw', 'got', 'made', 'took', 'gave', 'said', 'told', 'knew', 'thought', 'felt', 'ran', 'ate', 'drank', 'slept', 'sat', 'stood', 'swam', 'flew', 'wrote', 'drew', 'sang', 'rode', 'threw', 'caught', 'found', 'kept', 'built', 'brought', 'bought', 'sold', 'wore', 'held', 'hid', 'fell', 'grew', 'taught', 'won', 'lost', 'left', 'met', 'paid', 'sent', 'spent', 'woke', 'dug', 'fought', 'began', 'broke', 'chose', 'drove', 'forgot', 'heard', 'spoke', 'stole']);
const HELPERS = new Set(['will', 'would', 'can', 'could', 'should', 'must', 'may', 'might', 'shall', 'to', 'do', 'does', 'did', "don't", "doesn't", "didn't", "can't", "won't"]);
const BE = new Set(['am', 'is', 'are', 'was', 'were', 'be', 'been', 'being']);
const QUESTION_START = new Set(['is', 'are', 'am', 'was', 'were', 'do', 'does', 'did', 'can', 'could', 'will', 'would', 'should', 'have', 'has', 'who', 'what', 'where', 'when', 'why', 'how', 'which']);
const isWho = (c: MontessoriWordClass) => c === 'noun' || c === 'propernoun' || c === 'pronoun';

// Tag a sentence. A word the board doesn't know that sits where the Action belongs (right after the Who part)
// counts as the Action, so a new verb isn't called missing; known nouns and describing words never do.
const MODALS = new Set(['will', 'would', 'can', 'could', 'should', 'must', 'may', 'might', 'shall', "won't", "can't", "don't", "doesn't", "didn't"]);
export function tagForCheck(text: string): PatternWord[] {
  // Helping words (will, can, don't...) are part of the Action, as in her A-N-V-V formulas.
  const words = tagWordsPlain(text).map((w) => (MODALS.has(w.word.toLowerCase()) ? { ...w, wordClass: 'verb' as MontessoriWordClass } : w));
  if (words.some((w) => w.wordClass === 'verb')) return words;
  const who = words.findIndex((w) => isWho(w.wordClass));
  if (who < 0) return words;
  for (let i = who + 1; i < words.length; i++) {
    if (wordJobs(words[i].word).size === 0 && !/^[A-Z]/.test(words[i].word)) {
      return words.map((w, k) => (k === i ? { ...w, wordClass: 'verb' } : w));
    }
    if (isWho(words[i].wordClass)) continue;
  }
  return words;
}

export interface CheckResult {
  complete: boolean;
  missing: 'who' | 'action' | null;
  insertAt: number; // word index where the missing part goes
  capital: boolean;
  endMark: boolean;
  match: { ok: boolean; index?: number; from?: string; to?: string };
  time: boolean;
  code: string;
  formula: SentenceFormula | null;
  exact: boolean;
  words: PatternWord[];
}

const codeTokens = (code: string) => code.split(/[-,;:·“”"!?\s]+/).filter(Boolean);
function tokenDistance(a: string[], b: string[]): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const unitNumber = (f: SentenceFormula) => parseInt(f.unit, 10) || 99;

// The closest formula from her list: an exact match if there is one, otherwise the nearest complete formula
// (fewest slots to add, change or take out), preferring earlier units.
export function closestFormula(codes: string[]): { formula: SentenceFormula | null; exact: boolean } {
  let best: SentenceFormula | null = null;
  let bestScore = Infinity;
  for (const f of SENTENCE_FORMULAS) {
    const ft = codeTokens(f.code);
    const dist = tokenDistance(codes, ft);
    const score = dist * 10 + unitNumber(f) * 0.1;
    if (score < bestScore) { bestScore = score; best = f; }
  }
  const exact = !!best && tokenDistance(codes, codeTokens(best.code)) === 0;
  return { formula: best, exact };
}

export function checkSentence(s: SentenceSpan): CheckResult {
  const words = tagForCheck(s.text);
  const classes = words.map((w) => w.wordClass);
  const lower = words.map((w) => w.word.toLowerCase());
  const hasAction = classes.includes('verb');
  const whoIndex = classes.findIndex(isWho);
  const firstVerb = classes.indexOf('verb');
  const question = /\?["'”’)]*$/.test(s.text) || QUESTION_START.has(lower[0] ?? '');
  const command = firstVerb === 0 || (classes[0] === 'interjection' && firstVerb === 1) || (lower[0] === 'please' && firstVerb === 1);
  const hasWho = whoIndex >= 0 && (whoIndex < firstVerb || question || firstVerb < 0);
  let missing: CheckResult['missing'] = null;
  let insertAt = 0;
  if (!hasAction) {
    missing = 'action';
    // After the Who part: the article, describing words and the naming word at the start.
    let i = 0;
    while (i < classes.length && (classes[i] === 'interjection' || classes[i] === 'article' || classes[i] === 'adjective')) i++;
    while (i < classes.length && isWho(classes[i])) i++;
    insertAt = Math.max(1, i);
  } else if (!hasWho && !command) {
    missing = 'who';
    insertAt = 0;
  }
  const complete = !missing && words.length > 0;
  const capital = /^[^A-Za-z]*[A-Z]/.test(s.text) && !/\bi\b/.test(s.text);
  // Match: does each Action agree with its Who? (one or many)
  const agreed = agreeWords(words.map((w) => ({ word: w.word, cls: w.wordClass })));
  const mi = words.findIndex((w, i) => w.wordClass === 'verb' && agreed[i] !== w.word && !MODALS.has(lower[i]) && !HELPERS.has(lower[i - 1] ?? ''));
  const match = mi >= 0 ? { ok: false, index: mi, from: words[mi].word, to: agreed[mi] } : { ok: true };
  // Time: the Actions all tell past, or all tell present (a helper like will or did sets the time itself).
  const times = new Set<string>();
  words.forEach((w, i) => {
    if (w.wordClass !== 'verb') return;
    const lw = lower[i];
    const before = lower[i - 1] ?? '';
    if (HELPERS.has(before) || (BE.has(before) && /ing$/.test(lw))) return;
    if (lw === 'will' || lw === "won't") { times.add('future'); return; }
    if (lw === 'did' || lw === "didn't" || IRREGULAR_PAST.has(lw) || /ed$/.test(lw)) times.add('past');
    else if (!/ing$/.test(lw)) times.add('present');
  });
  const time = !(times.has('past') && times.has('present'));
  const codes = classes.map((c) => CODE[c] ?? 'N');
  const { formula, exact } = closestFormula(codes);
  return { complete, missing, insertAt, capital, endMark: s.ended, match, time, code: codes.join('-'), formula, exact, words };
}

// The words the check uses (her answer 2026-10-28): the true grammar terms at every level (verb, subject,
// adjective), never stand-ins like "Action word". Levels change only whether formula codes show.
export type Level = 'A' | 'B' | 'C';
export const CHECK_LABELS = { complete: 'Complete sentence (subject and verb)', capital: 'Capital letters', endMark: 'End punctuation', match: 'Subject-verb agreement', time: 'Same verb tense', who: 'a subject', action: 'a verb' } as const;
export type CheckItem = 'complete' | 'capital' | 'endMark' | 'match' | 'time';
