import { agreeWords, type PatternWord } from '../sentenceSearch';
import { tagInContext, type TaggedWord } from './tagger';
import type { MontessoriWordClass } from '../montessoriGrammar';
import type { SentenceFormula } from './formulas';
import { cardSlotsOf, closestFormula, formulaCode, sentenceSlots } from './formulaMatch';

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
    const span = { start: m.index + lead, end: m.index + lead + t.length, text: t, ended: /[.!?]["'”’)]*$/.test(t) };
    // "Dr. Lee" is one sentence: a title's period doesn't end it.
    const prev = out[out.length - 1];
    if (prev && /(^|\s)(Dr|Mr|Mrs|Ms|St|Jr|Sr|Mt|Prof)\.$/.test(prev.text)) {
      prev.end = span.end;
      prev.text = text.slice(prev.start, span.end);
      prev.ended = span.ended;
      continue;
    }
    out.push(span);
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
// Verbs whose base form already ends in -ed or -ing.
const BASE_ED_ING = new Set(['bring', 'sing', 'ring', 'swing', 'sting', 'cling', 'fling', 'spring', 'string', 'wring', 'need', 'feed', 'bleed', 'breed', 'speed', 'shed', 'seed', 'weed', 'plead', 'heed', 'proceed', 'succeed', 'exceed']);
const isWho = (c: MontessoriWordClass) => c === 'noun' || c === 'propernoun' || c === 'pronoun';

// Tag a sentence. A word the board doesn't know that sits where the Action belongs (right after the Who part)
// counts as the Action, so a new verb isn't called missing; known nouns and describing words never do.
const MODALS = new Set(['will', 'would', 'can', 'could', 'should', 'must', 'may', 'might', 'shall', "won't", "can't", "don't", "doesn't", "didn't"]);
export function tagForCheck(text: string): TaggedWord[] {
  // Each word's job from the word itself and its place in the sentence (tagger.ts, which also makes sure a
  // sentence gets a verb when one of its words can be one); helping words (will, can, don't...) are verbs, as in
  // her formulas.
  return tagInContext(text).map((w) => (MODALS.has(w.word.toLowerCase()) ? { ...w, wordClass: 'verb' as MontessoriWordClass } : w));
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
  slots: string[];
  formula: SentenceFormula | null;
  exact: boolean;
  words: PatternWord[];
}

export function checkSentence(s: SentenceSpan): CheckResult {
  const words = tagForCheck(s.text);
  const classes = words.map((w) => w.wordClass);
  const lower = words.map((w) => w.word.toLowerCase());
  // A contraction does both its jobs: "We've" is the subject and the verb.
  const does = (i: number, test: (c: MontessoriWordClass) => boolean) => test(classes[i]) || !!words[i].parts?.some(test);
  const isVerb = (c: MontessoriWordClass) => c === 'verb';
  const hasAction = words.some((_, i) => does(i, isVerb));
  const whoIndex = words.findIndex((_, i) => does(i, isWho));
  const firstVerb = words.findIndex((_, i) => does(i, isVerb) && !(words[i].parts && words[i].parts![0] !== 'verb' && i === whoIndex));
  const firstVerbAt = firstVerb < 0 ? words.findIndex((_, i) => does(i, isVerb)) : firstVerb;
  const question = /\?["'”’)]*$/.test(s.text) || QUESTION_START.has(lower[0] ?? '');
  // A command starts with a verb in its base form ("Close the door."); "Named Rob." is not a command.
  const baseVerb = (i: number) => i >= 0 && (!/(ed|ing)$/.test(lower[i]) || BASE_ED_ING.has(lower[i])) && !IRREGULAR_PAST.has(lower[i]) && !(/[^s]s$/.test(lower[i]) && !words[i].parts);
  // Before a command's verb there can only be "please", a how word or a name and a comma ("First, wash...",
  // "Sam, close the door.").
  const openers = firstVerb >= 0 && words.slice(0, firstVerb).every((w, i) => w.wordClass === 'interjection' || w.wordClass === 'adverb' || lower[i] === 'please' || w.wordClass === 'propernoun');
  const command = openers && !words[0]?.parts?.some(isWho) && baseVerb(firstVerb);
  const hasWho = whoIndex >= 0 && (whoIndex <= firstVerbAt || question || firstVerbAt < 0);
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
  const mi = words.findIndex((w, i) => w.wordClass === 'verb' && !w.parts && agreed[i] !== w.word && !MODALS.has(lower[i]) && !HELPERS.has(lower[i - 1] ?? ''));
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
  // Her formulas write a contraction like "doesn't" as one verb (A-N-V-V) and "Let's" as a verb and a pronoun.
  // Her formula cards: the closest card, and her code for this sentence (a new formula when no card matches).
  const mine = sentenceSlots(words, s.text);
  const { formula, exact } = closestFormula(mine);
  return { complete, missing, insertAt, capital, endMark: s.ended, match, time, code: formulaCode(mine, s.text), slots: cardSlotsOf(mine), formula, exact, words };
}

// The words the check uses (her answer 2026-10-28): the true grammar terms at every level (verb, subject,
// adjective), never stand-ins like "Action word". Levels change only whether formula codes show.
export type Level = 'A' | 'B' | 'C';
export const CHECK_LABELS = { complete: 'Complete sentence (subject and verb)', capital: 'Capital letters', endMark: 'End punctuation', match: 'Subject-verb agreement', time: 'Same verb tense', who: 'a subject', action: 'a verb' } as const;
export type CheckItem = 'complete' | 'capital' | 'endMark' | 'match' | 'time';

// Sentence problems marked as the student writes (her request 2026-10-28): an incomplete sentence (a fragment)
// gets a red wavy line, a run-on (two sentences joined with no end mark, or only a comma) a blue one.
export type SentenceIssue =
  | { kind: 'fragment'; why: 'verb' | 'subject' | 'clause' }
  | { kind: 'runon'; at: number; comma: boolean }
  | null;
const SUBORDINATORS = new Set(['because', 'although', 'though', 'since', 'unless', 'while', 'whereas', 'if', 'when', 'whenever', 'after', 'before', 'until', 'once']);
const COORDINATORS = new Set(['and', 'but', 'or', 'so', 'yet', 'for', 'nor', 'then']);
const NEW_SUBJECTS = new Set(['i', 'he', 'she', 'we', 'they']);
const COMMA_SUBJECTS = new Set(['i', 'he', 'she', 'we', 'they', 'it', 'you']);
const REPLIES = /^(yes|no|yeah|nope|ok|okay|thanks|thank you|hi|hello|bye|goodbye|sure|maybe|please|sorry|the end)$/;
const SAY_VERBS = /^(said|says|say|asked|asks|ask|yelled|shouted|whispered|replied|answered|explained|cried|called)$/;

export function sentenceIssue(s: SentenceSpan): SentenceIssue {
  const words = tagForCheck(s.text);
  if (!words.length) return null;
  const spans = [...s.text.matchAll(/[A-Za-z']+/g)].map((m) => m.index ?? 0);
  const gap = (i: number) => s.text.slice(i ? spans[i - 1] + words[i - 1].word.length : 0, spans[i]);
  const lower = words.map((w) => w.word.toLowerCase());
  const cls = words.map((w) => w.wordClass);
  // One-word answers and exclamations ("Yes.", "Wow!") are fine on their own.
  if ((words.length === 1 && /!\s*["”']?$/.test(s.text)) || words.every((w) => w.wordClass === 'interjection' || w.wordClass === 'adverb') || (words.length <= 2 && REPLIES.test(lower.join(' ')))) return null;
  const r = checkSentence(s);
  if (!r.complete) return { kind: 'fragment', why: r.missing === 'who' ? 'subject' : 'verb' };
  // "Because I was tired." : a joining word starts it, and no main idea follows.
  if (SUBORDINATORS.has(lower[0]) && !/,/.test(s.text.slice(spans[1] ?? 0)) && !/\?/.test(s.text)) return { kind: 'fragment', why: 'clause' };

  // Run-ons: walk the sentence clause by clause. A clause is complete once it has a subject and a verb.
  const isWho = (i: number) => cls[i] === 'noun' || cls[i] === 'propernoun' || cls[i] === 'pronoun' || !!words[i].parts?.some((c) => c === 'pronoun');
  const isVerb = (i: number) => cls[i] === 'verb' || !!words[i].parts?.includes('verb');
  let subject = false, verb = false, intro = SUBORDINATORS.has(lower[0]);
  const verbSoon = (i: number) => { for (let k = i; k < Math.min(words.length, i + 4); k++) { if (isVerb(k)) return k; if (cls[k] === 'conjunction' || cls[k] === 'preposition') return -1; } return -1; };
  for (let i = 0; i < words.length; i++) {
    const g = gap(i);
    if (/[;:—–]|["“”]/.test(g)) { subject = false; verb = false; intro = false; }
    const complete = subject && verb;
    const startsClause = (COMMA_SUBJECTS.has(lower[i]) || cls[i] === 'article' || (cls[i] === 'propernoun' && i > 0)) && verbSoon(i + 1) > 0 && !SAY_VERBS.test(lower[verbSoon(i + 1)]);
    if (complete && !intro && startsClause && i > 0) {
      // "I like dogs, they are fun." : only a comma between two sentences.
      if (/,/.test(g) && !COORDINATORS.has(lower[i])) return { kind: 'runon', at: spans[i], comma: true };
      // "I like dogs they are fun." / "it was fun We played": nothing between them. Only when the first sentence
      // clearly ended (a describing or how word, a capital letter, or "is/was" after the new subject), so "the
      // book he gave me" isn't marked.
      const prevEnded = cls[i - 1] === 'adjective' || cls[i - 1] === 'adverb' || (/^[A-Z]/.test(words[i].word) && lower[i] !== 'i')
        || (i >= 2 && /^(is|are|was|were|am|feel|felt|seems?|seemed|looks?|looked)$/.test(lower[i - 2]));
      const nextIsBe = /^(is|are|was|were|am)$/.test(lower[verbSoon(i + 1)] ?? '');
      if (!/,/.test(g) && NEW_SUBJECTS.has(lower[i]) && (prevEnded || nextIsBe) && !['conjunction', 'preposition', 'verb'].includes(cls[i - 1])) return { kind: 'runon', at: spans[i], comma: false };
      if (!/,/.test(g) && cls[i] === 'article' && /^[A-Z]/.test(words[i].word)) return { kind: 'runon', at: spans[i], comma: false };
    }
    if (cls[i] === 'conjunction') { if (/,/.test(g) && intro) intro = false; subject = false; verb = false; continue; }
    if (/,/.test(g) && intro && complete) { intro = false; subject = false; verb = false; }
    if (isWho(i) && !verb) subject = true;
    if (isVerb(i) && subject) verb = true;
    if (isVerb(i) && !subject && i === 0) { subject = true; verb = true; }
  }
  return null;
}
