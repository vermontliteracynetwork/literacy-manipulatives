import { tagForCheck } from '../writer/sentenceCheck';
import { closestFormula, sentenceSlots } from '../writer/formulaMatch';

// Her formula code for an example sentence (build spec 4.2 and 5): only when the sentence matches one of her
// formula cards exactly (src/lib/writer/formulas.ts, her Formula Master List). Never a lesson number.
export function formulaFor(sentence: string): string {
  if (!/[.!?]$/.test(sentence.trim()) || !/^[A-Z]/.test(sentence.trim())) return ''; // a phrase, not a sentence
  const slots = sentenceSlots(tagForCheck(sentence), sentence);
  if (!slots.length) return '';
  const best = closestFormula(slots);
  return best.exact && best.formula ? best.formula.code : '';
}
