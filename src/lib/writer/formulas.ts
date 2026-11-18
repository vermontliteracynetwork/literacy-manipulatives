// Literacy Manipulatives' formula cards: every formula in her master list (from the Symbolic Grammar Engine) as a card
// with its symbols in order; a formula that has one of this app's printed card pictures keeps it. The card pictures
// and card layout are this app's; the formulas themselves come from the engine.
import { SENTENCE_FORMULAS as CARD_SET, type SentenceFormula as CardFormula } from 'symbolic-grammar-engine/src/writer/formulas';
import { MASTER_FORMULAS } from 'symbolic-grammar-engine/src/writer/masterList';
export interface SentenceFormula extends Omit<CardFormula, 'card' | 'sentenceCard'> { card?: string; sentenceCard?: string; name?: string; purpose?: string; required?: string }

/** Her formula (symbol words) plus its model sentence, as card slots: a helping verb becomes will, be or do; not is
 *  not; a preposition and the words after it are one prepositional phrase. */
function cardSlots(formula: string, sentence: string): string[] {
  const slots = formula.replace(/proper noun/g, 'propernoun').split(/\s+/).filter((w) => /^[a-z]+$/.test(w));
  const words = sentence.replace(/[“”"]/g, ' ').split(/\s+/).map((w) => w.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, '').toLowerCase().replace(/’/g, "'")).filter(Boolean);
  const out: string[] = [];
  let w = 0;
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const word = words[w] ?? '';
    if (slot === 'preposition') {
      w++;
      let j = i + 1;
      while (slots[j] === 'article' || slots[j] === 'adjective' || slots[j] === 'pronoun') { j++; w++; }
      if (slots[j] === 'noun' || slots[j] === 'propernoun') {
        w++;
        if (slots[j] === 'propernoun' && slots[j + 1] === 'propernoun') { j++; w++; }
        i = j;
      }
      out.push('phrase');
      continue;
    }
    w++;
    if (slot === 'verb') {
      if (word === 'will') out.push('will');
      else if (/^(am|is|are|was|were|be)$/.test(word)) out.push('be');
      else if (/^(isn't|aren't|wasn't|weren't)$/.test(word)) out.push('be', 'not');
      else if (/^(do|does|did)$/.test(word)) out.push('do');
      else if (/^(don't|doesn't|didn't)$/.test(word)) out.push('do', 'not');
      else out.push('verb');
    } else if (slot === 'adverb') out.push(word === 'not' ? 'not' : 'adverb');
    else if (slot === 'conjunction') out.push(word || 'and');
    else if (slot === 'pronoun' && /'(re|m|s)$/.test(word)) out.push('pronoun', 'be');
    else out.push(slot);
  }
  return out;
}

export const SENTENCE_FORMULAS: SentenceFormula[] = MASTER_FORMULAS.map((m) => {
  const lesson = m.skill.replace(/[a-z]$/, '');
  const printed = CARD_SET.find((c) => c.sentence === m.sentence) ?? CARD_SET.find((c) => c.code === m.code && c.lesson === lesson);
  return {
    unit: m.unit, lesson: m.skill, code: m.code, formula: m.formula, slots: cardSlots(m.formula, m.sentence), sentence: m.sentence,
    card: printed?.card, sentenceCard: printed?.sentenceCard, name: m.name, purpose: m.purpose, required: m.required,
  };
});
