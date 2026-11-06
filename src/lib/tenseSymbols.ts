// Her past, present and future symbols on the whiteboard (her request 2026-11-06: "these can be stand alone and
// can also be attatched on top of a verb (placed above) to change the tense of the verb"). Placed on a verb, the
// verb's word changes to that tense; taken off, the word goes back to what it was.
import { baseOf, pastOf, third } from './writer/tenses';

export type Tense = 'past' | 'present' | 'future';

const PRESENT_BE = new Set(['am', 'is', 'are']);

export function verbInTense(word: string, tense: Tense): string {
  const raw = word.trim();
  if (!raw) return raw;
  const cap = /^[A-Z]/.test(raw);
  // "will run" is the future of run: its base is the last word.
  const lower = raw.toLowerCase().replace(/^will\s+/, '').trim();
  if (!lower || /\s/.test(lower)) return raw;
  const base = baseOf(lower);
  let out: string;
  if (base === 'be') {
    // be keeps its person: am/is/was, are/were.
    const many = lower === 'are' || lower === 'were';
    out = tense === 'future' ? 'will be' : tense === 'past' ? (many ? 'were' : 'was') : PRESENT_BE.has(lower) ? lower : many ? 'are' : 'is';
  } else if (tense === 'future') {
    out = `will ${base}`;
  } else if (tense === 'past') {
    out = pastOf(base);
  } else {
    // "runs" stays "runs"; anything else goes back to "run".
    out = lower !== base && third(base) === lower ? lower : base;
  }
  return cap ? out[0].toUpperCase() + out.slice(1) : out;
}
