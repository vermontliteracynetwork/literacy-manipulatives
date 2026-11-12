import { tagForCheck } from '../writer/sentenceCheck';
import { closestFormula, formulaCode, sentenceSlots } from '../writer/formulaMatch';
import { FORMULA_LIST } from '../writer/formulaList';

// Her formula code for an example sentence (build spec 4.2 and 5): only when the sentence is one of her formulas
// (her All Sentence Formulas list, src/lib/writer/formulaList.ts, or a formula card). Never a lesson number.
const CODES = new Set(FORMULA_LIST.map((f) => f.code.replace(/\*$/, '')));
export function formulaFor(sentence: string): string {
  const t = sentence.trim();
  if (!/[.!?]$/.test(t) || !/^[A-Z]/.test(t)) return ''; // a phrase, not a sentence
  const slots = sentenceSlots(tagForCheck(t), t);
  if (!slots.length) return '';
  const code = formulaCode(slots, t);
  if (CODES.has(code)) return code;
  const best = closestFormula(slots);
  return best.exact && best.formula ? best.formula.code : '';
}
