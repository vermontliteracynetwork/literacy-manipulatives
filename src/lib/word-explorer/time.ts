import type { Time } from './types';
import { readText } from '../grammarEngine';
import { baseOf, pastOf } from '../writer/tenses';
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
  const isPast = (v: string) => ['was', 'were', 'did', 'had'].includes(v) || (v.endsWith('ed') && v.length > 3)
    || (() => { const b = irregularBase(v) ?? baseOf(v); return !!b && b !== v && pastOf(b) === v; })();
  return verbs.some(isPast) ? 'past' : 'present';
}
