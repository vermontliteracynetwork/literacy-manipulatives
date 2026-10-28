import { SENTENCE_FORMULAS, type SentenceFormula } from './formulas';
import type { TaggedWord } from './tagger';
import type { MontessoriWordClass } from '../montessoriGrammar';

// Matching a student's sentence to her formula cards (her Formula Master List, 2026-10-28). A sentence is read
// the way her cards read it: one card per word, except a prepositional phrase ("to the park"), which is one card,
// and required words (be, will, do, not, feel, and, because...) named on the card itself. Contractions are two
// cards ("We're": pronoun, be).

export interface Slot { slot: string; word: string; key?: string; comma: boolean; semi?: boolean; contracted?: 'not' | 'pronoun'; from?: number; to?: number }

const BE = new Set(['am', 'is', 'are', 'was', 'were', 'be', 'been', 'being']);
const DO = new Set(['do', 'does', 'did']);
const FEEL = new Set(['feel', 'feels', 'felt']);
const JOINERS = new Set(['so that', 'and', 'but', 'or', 'so', 'yet', 'nor', 'because', 'since', 'that', 'after', 'before', 'when', 'if', 'while', 'until', 'although', 'though', 'unless']);
const KEYED = new Set(['will', 'not', 'said', 'could', 'please']);
const CONTRACTED_VERB: Record<string, string> = { "'m": 'be', "'re": 'be', "'s": 'be', "'ve": 'have', "'ll": 'will', "'d": 'would' };
const NOUNISH = new Set<string>(['noun', 'propernoun', 'pronoun']);

const keyOf = (w: string): string | undefined => {
  if (BE.has(w)) return 'be';
  if (DO.has(w)) return 'do';
  if (FEEL.has(w)) return 'feel';
  if (KEYED.has(w) || JOINERS.has(w)) return w;
  return undefined;
};

// The student's sentence as card slots.
export function sentenceSlots(words: TaggedWord[], text: string): Slot[] {
  const spans = [...text.matchAll(/[A-Za-z']+/g)].map((m) => m.index ?? 0);
  const gap = (i: number) => text.slice(i ? spans[i - 1] + words[i - 1].word.length : 0, spans[i]);
  const out: Slot[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const lower = w.word.toLowerCase().replace(/’/g, "'");
    const comma = /,/.test(gap(i) ?? '');
    const semi = /;/.test(gap(i) ?? '');
    if (w.parts) {
      // "We're" -> pronoun + be; "didn't" -> do + not; "Let's" -> verb + pronoun.
      const nt = lower.match(/^(.+)n't$/);
      if (nt) {
        const v = nt[1] === 'ca' ? 'can' : nt[1] === 'wo' ? 'will' : nt[1];
        out.push({ slot: 'verb', word: v, key: keyOf(v) ?? v, comma, contracted: 'not' }, { slot: 'adverb', word: 'not', key: 'not', comma: false });
      } else if (lower === "let's") {
        out.push({ slot: 'verb', word: 'let', comma }, { slot: 'pronoun', word: 'us', comma: false });
      } else {
        const m = lower.match(/^(.+?)('m|'re|'s|'ve|'ll|'d)$/);
        out.push({ slot: w.parts[0], word: m?.[1] ?? lower, comma, contracted: 'pronoun' }, { slot: 'verb', word: m?.[2] ?? '', key: m ? CONTRACTED_VERB[m[2]] : undefined, comma: false });
      }
      continue;
    }
    // Two names in a row are one name ("Dr. Lee"); "so that" is one joining word.
    if (w.wordClass === 'propernoun' && out[out.length - 1]?.slot === 'propernoun' && !comma) { out[out.length - 1].word += ` ${lower}`; continue; }
    if (lower === 'that' && out[out.length - 1]?.word === 'so') { out[out.length - 1] = { ...out[out.length - 1], slot: 'conjunction', word: 'so that', key: 'so that' }; continue; }
    // "at 3:15": a preposition before a number is a phrase too.
    const after = text.slice(spans[i] + w.word.length);
    if (/^(at|on|in|by|from|to|until|after|before|since)$/.test(lower) && /^\s*\d/.test(after)) { out.push({ slot: 'phrase', word: `${lower} ${after.trim().split(/\s/)[0]}`, comma, semi }); continue; }
    // "According to the book": one phrase.
    if (lower === 'according' && words[i + 1]?.word.toLowerCase() === 'to') continue;
    // A prepositional phrase is one card: the preposition and the words up to its noun.
    if (w.wordClass === 'preposition' || (lower === 'than' && words[i + 1])) {
      let j = i + 1;
      while (j < words.length && ['article', 'adjective', 'adverb'].includes(words[j].wordClass) && !NOUNISH.has(words[j].wordClass)) j++;
      if (j < words.length && (NOUNISH.has(words[j].wordClass) || (words[j].wordClass === 'pronoun'))) {
        while (j + 1 < words.length && words[j + 1].wordClass === 'noun' && !/[,;]/.test(gap(j + 1))) j++;
        const from = words[i - 1]?.word.toLowerCase() === 'according' && lower === 'to' ? i - 1 : i;
        out.push({ slot: 'phrase', word: words.slice(i, j + 1).map((x) => x.word.toLowerCase()).join(' '), comma, semi, from, to: j });
        i = j;
        continue;
      }
    }
    const key = w.wordClass === 'verb' || w.wordClass === 'conjunction' || w.wordClass === 'adverb' || lower === 'that' || lower === 'said' ? keyOf(lower) : undefined;
    out.push({ slot: w.wordClass, word: lower, key, comma, semi });
  }
  return out;
}

// How far a slot on her card is from a student slot: 0 the same, 1 different.
const WORD_SLOTS = new Set(['be', 'do', 'will', 'not', 'feel', 'said', 'could', 'please', ...JOINERS]);
function cost(cardSlot: string, s: Slot): number {
  if (WORD_SLOTS.has(cardSlot)) return s.key === cardSlot || s.word === cardSlot ? 0 : 1;
  if (cardSlot === 'verb') return s.slot === 'verb' ? (s.key === 'be' || s.key === 'do' ? 0.6 : 0) : 1;
  if (cardSlot === 'conjunction') return s.slot === 'conjunction' ? 0 : 1;
  if (cardSlot === 'adverb') return s.slot === 'adverb' && s.key !== 'not' && s.key !== 'please' ? 0 : 1;
  if (cardSlot === 'pronoun') return s.slot === 'pronoun' ? 0 : 1;
  return s.slot === cardSlot ? 0 : 1;
}
export const slotMatches = (cardSlot: string, s: Slot) => cost(cardSlot, s) === 0;
export function slotDistance(card: string[], mine: Slot[]): number {
  const d = Array.from({ length: card.length + 1 }, (_, i) => [i, ...Array(mine.length).fill(0)]);
  for (let j = 1; j <= mine.length; j++) d[0][j] = j;
  for (let i = 1; i <= card.length; i++) for (let j = 1; j <= mine.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost(card[i - 1], mine[j - 1]));
  return d[card.length][mine.length];
}

// The formula card closest to the sentence: exact when every slot matches.
export function closestFormula(mine: Slot[]): { formula: SentenceFormula | null; exact: boolean; distance: number } {
  let best: SentenceFormula | null = null;
  let bestD = Infinity;
  for (const f of SENTENCE_FORMULAS) {
    const d = slotDistance(f.slots, mine);
    if (d < bestD) { bestD = d; best = f; }
  }
  return { formula: best, exact: bestD === 0, distance: bestD };
}
export const formulasLike = (mine: Slot[], limit = 6) => SENTENCE_FORMULAS
  .map((f) => ({ f, d: slotDistance(f.slots, mine) }))
  .sort((a, b) => a.d - b.d)
  .slice(0, limit);

// Her card label for a student slot ("be", "and", "prepositional phrase"...), the words that go above a symbol.
export const slotLabel = (s: string) => (s === 'propernoun' ? 'proper noun' : s === 'phrase' ? 'prepositional phrase' : s);
// The symbol for a card slot.
export function slotClass(s: string): MontessoriWordClass {
  if (s === 'phrase') return 'preposition';
  if (['be', 'do', 'will', 'feel', 'said', 'could'].includes(s)) return 'verb';
  if (s === 'not' || s === 'please') return 'adverb';
  if (JOINERS.has(s)) return 'conjunction';
  return s as MontessoriWordClass;
}
// Card slots for a student sentence, as her card would name them (required words named, the rest by job).
export const cardSlotsOf = (mine: Slot[]) => mine.map((s) => (s.key && WORD_SLOTS.has(s.key) ? s.key : s.slot));

// ---------- Her formula code for a new sentence pattern ----------
// Clause types (her Master List): S1 subject-verb, S2 with an object, S3 be + describing word, S4 be + noun,
// S5 be + prepositional phrase, S6 feel + describing word; Sn a "not" statement; Q questions (Q1, Q2 with an
// object, Q3 be + describing word); C commands (C1, C2 with an object, Cn "don't"); E exclamations (E1, E3).
// Then the parts: A article, PN proper noun, P pronoun, N a noun that owns ('s), V each extra verb, J describing
// word, B how word, PRP prepositional phrase, C joining word, I interjection. Clauses join as (X)+(Y) with a
// comma and and/but/or/so, (X)C(Y) with because/when/that..., C(X)(Y) when the joining word comes first, (X);(Y)
// with a semicolon, and an opener with a comma wraps the rest: B(X), PRP(X), PN(X).
const SUBORD = new Set(['because', 'since', 'that', 'after', 'before', 'when', 'if', 'while', 'until', 'although', 'though', 'unless']);
const COORD = new Set(['and', 'but', 'or', 'so', 'yet', 'nor']);

const AUX = new Set(['be', 'do', 'will', 'can', 'could', 'would', 'should', 'may', 'might', 'must', 'have', 'has', 'had']);
const auxOf = (s: Slot) => s.key ?? s.word;

function clauseCode(c: Slot[], end: string, first: boolean, opts: { exclaim?: boolean; objectClause?: boolean } = {}): string {
  const verbs = c.map((s, i) => (s.slot === 'verb' ? i : -1)).filter((i) => i >= 0);
  const v = verbs[0] ?? -1;
  const before = c.slice(0, Math.max(0, v));
  const hasSubject = before.some((s) => NOUNISH.has(s.slot));
  const not = c.some((s) => s.key === 'not');
  // The main verb: the last of a run of verbs ("will run", "did not fly", "is floating", "can come").
  let mainIdx = v;
  while (mainIdx >= 0) {
    const nextVerb = verbs.find((i) => i > mainIdx && c.slice(mainIdx + 1, i).every((s) => s.key === 'not' || s.slot === 'adverb' || NOUNISH.has(s.slot) || s.slot === 'article' || s.slot === 'adjective'));
    if (nextVerb === undefined || !AUX.has(auxOf(c[mainIdx]))) break;
    mainIdx = nextVerb;
  }
  const main = c[mainIdx];
  const rest = c.slice(mainIdx + 1);
  const afterSkip = rest.filter((s) => s.key !== 'not' && !(s.slot === 'adverb'));
  const next = afterSkip[0];
  const object = afterSkip.some((s) => NOUNISH.has(s.slot) || s.slot === 'article') || !!opts.objectClause
    || (end === '?' && ['what', 'whom', 'which'].includes(c[0]?.word ?? '') && verbs.length > 1);
  // The word right after be or feel completes it ("is slow", "is under the bed") and isn't counted as a part.
  let complement = -1;
  let type: string;
  if (end === '?' && first) {
    const q3 = auxOf(c[v] ?? { slot: '', word: '' }) === 'be' && verbs.length === 1;
    if (q3) complement = c.findIndex((s, i) => i > v && s.slot === 'adjective');
    type = q3 && complement >= 0 ? 'Q3' : object ? 'Q2' : 'Q1';
  } else if (!hasSubject && v >= 0 && before.every((s) => s.slot === 'adverb' || s.key === 'please' || s.slot === 'interjection')) {
    type = `C${not ? 'n' : ''}${object ? 2 : 1}`;
  } else {
    let n = object ? 2 : 1;
    const ni = next ? c.indexOf(next) : -1;
    if (main?.key === 'be') {
      n = next?.slot === 'adjective' ? 3 : next && (next.slot === 'article' || NOUNISH.has(next.slot)) ? 4 : next?.slot === 'phrase' ? 5 : 1;
      if (n === 3 || n === 5) complement = ni;
    }
    if (main?.key === 'feel' && next?.slot === 'adjective') { n = 6; complement = ni; }
    const e = (opts.exclaim || end === '!') && first;
    type = `${e ? 'E' : 'S'}${not && !e ? 'n' : ''}${n}`;
  }
  const own = c.filter((_, i) => i !== complement);
  const count = (test: (s: Slot) => boolean, letter: string) => Array(own.filter(test).length).fill(letter);
  const owns = (s: Slot) => /'s$/.test(s.word);
  let parts = [
    ...count((s) => s.slot === 'article', 'A'), ...count((s) => s.slot === 'propernoun' && !owns(s), 'PN'), ...count((s) => s.slot === 'propernoun' && owns(s), "PN's"),
    ...count((s) => s.slot === 'pronoun', 'P'), ...count((s) => s.slot === 'noun' && owns(s), "N's"), ...Array(Math.max(0, verbs.length - 1)).fill('V'),
    ...count((s) => s.slot === 'adjective', 'J'), ...count((s) => s.slot === 'adverb', 'B'), ...count((s) => s.slot === 'phrase', 'PRP'),
    ...count((s) => s.slot === 'conjunction', 'C'), ...count((s) => s.slot === 'interjection', 'I'),
  ];
  // A contraction joins its two parts with an apostrophe: "We're" P'V, "isn't" V'B.
  if (c.some((s) => s.contracted === 'pronoun') && parts.includes('P')) parts = parts.map((p, i) => (i === parts.indexOf('P') ? "P'V" : p));
  if (c.some((s) => s.contracted === 'not') && parts.includes('B')) {
    const vi = parts.indexOf('V');
    if (vi >= 0) parts.splice(vi, 1);
    parts = parts.map((p, i) => (i === parts.indexOf('B') ? "V'B" : p));
  }
  return [type, ...parts].join('.').replace(/\.'/g, "'");
}

export function formulaCode(mine: Slot[], text: string): string {
  const end = (text.trim().match(/[.?!]/g) ?? ['.']).pop()!;
  if (!mine.length) return '';
  const exclaim = mine.some((s) => s.slot === 'interjection') || /!/.test(text);
  const verbIn = (part: Slot[]) => part.some((x) => x.slot === 'verb');
  // An opener and a comma: "Quickly, ...", "After lunch, ...", and a name before a command: "Sam, close...".
  if (mine.length > 2 && mine[1].comma && verbIn(mine.slice(1))) {
    if (mine[0].slot === 'adverb' || mine[0].slot === 'phrase') return `${mine[0].slot === 'adverb' ? 'B' : 'PRP'}(${formulaCode(mine.slice(1), text)})`;
    if (mine[0].slot === 'propernoun' && mine[1].slot === 'verb') return `PN(${formulaCode(mine.slice(1), text)})`;
  }
  // A name after a command: "Close the door, Sam."
  const lastI = mine.length - 1;
  if (mine.length > 2 && mine[lastI].slot === 'propernoun' && mine[lastI].comma && mine[0].slot === 'verb') return `(${formulaCode(mine.slice(0, lastI), text)})PN`;
  const wrap = (code: string) => (/^(B|PRP|PN|C)\(/.test(code) ? code : `(${code})`);
  // "Because it rained, we stayed in.": the joining word first, then a comma before the main idea.
  const lead = !!mine[0].key && SUBORD.has(mine[0].key) && mine[0].slot !== 'pronoun';
  if (lead) {
    const i = mine.findIndex((s, k) => k > 1 && s.comma && verbIn(mine.slice(1, k)) && verbIn(mine.slice(k)));
    return i > 0 ? `C(${clauseCode(mine.slice(1, i), end, false)})(${clauseCode(mine.slice(i), end, true, { exclaim })})` : `C(${clauseCode(mine.slice(1), end, false)})`;
  }
  for (let i = 1; i < mine.length; i++) {
    const s = mine[i];
    if (!verbIn(mine.slice(0, i)) || !verbIn(mine.slice(i))) continue;
    if (s.semi) return `(${clauseCode(mine.slice(0, i), end, true, { exclaim })});${wrap(formulaCode(mine.slice(i), text))}`;
    if (s.key && COORD.has(s.key) && s.comma && mine.slice(i + 1).some((x) => NOUNISH.has(x.slot))) return `(${clauseCode(mine.slice(0, i), end, true, { exclaim })})+(${clauseCode(mine.slice(i + 1), end, false)})`;
    if (s.key && (SUBORD.has(s.key) || s.key === 'so that') && verbIn(mine.slice(i + 1))) {
      // "I think that dogs are smart.": the that-part is what's thought, so the first part has an object (S2).
      const objectClause = s.key === 'that' && mine[i - 1]?.slot === 'verb';
      return `(${clauseCode(mine.slice(0, i), end, true, { exclaim, objectClause })})C(${clauseCode(mine.slice(i + 1), end, false)})`;
    }
  }
  return clauseCode(mine, end, true, { exclaim });
}
