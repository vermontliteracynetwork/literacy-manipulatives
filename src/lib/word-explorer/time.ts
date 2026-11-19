import type { Time } from './types';
import { readText } from '../grammarEngine';
import { baseOf, isIrregularPast, pastOf, pastParticipleOf } from 'symbolic-grammar-engine';
import { irregularBase } from './data';

// Past, present or future for an example sentence (spec 4.2: each example is tagged with its time).
// Undefined for a phrase with no verb ("a happy smile").
export function timeOf(text: string): Time | undefined {
  const words = text.split(/\s+/).map((w) => w.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, '')).filter(Boolean);
  if (!words.length) return undefined;
  const lower = words.map((w) => w.toLowerCase());
  if (lower.some((w, i) => w === 'will' || w === 'shall' || w.endsWith("'ll") || (w === 'going' && lower[i + 1] === 'to' && i > 0))) return 'future';
  // The grammar engine every tool uses reads the verbs (src/lib/grammarEngine.ts).
  const verbs = readText(text).filter((w) => w.wordClass === 'verb' || w.parts?.includes('verb')).map((w) => w.word.toLowerCase());
  if (!verbs.length) return undefined;
  // Past when the engine says the verb is a past form (ran, hopped, cried), not just for ending in -ed (need, feed).
  const isPast = (v: string) => ['was', 'were', 'did', 'had'].includes(v) || isIrregularPast(v)
    || [baseOf(v), irregularBase(v)].some((b) => !!b && b !== v && (pastOf(b) === v || pastParticipleOf(b) === v));
  return verbs.some(isPast) ? 'past' : 'present';
}
