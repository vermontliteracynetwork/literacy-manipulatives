import { SENTENCE_FORMULAS } from './formulas';
import { tagForCheck } from './sentenceCheck';
import { cardSlotsOf, formulaCode, sentenceSlots, slotDistance, type Slot } from './formulaMatch';
import { FORMULA_LIST, type ListedFormula } from './formulaList';

// Looking a sentence up in her formula list (Formula Search's sentence and passage tabs share this).
// Her "All Sentence Formulas" list is the main list. Each formula's pattern is read from its own example sentence
// by the same engine that reads the typed sentence, so they are compared the same way.
export interface Listed extends ListedFormula { slots: Slot[]; cardSlots: string[]; card?: string; uses?: Listed[] }
let listed: Listed[] | null = null;
export function listedFormulas(): Listed[] {
  listed ??= FORMULA_LIST.map((f) => {
    const t = f.example.replace(/[“”]/g, '"');
    const slots = sentenceSlots(tagForCheck(t), t);
    return { ...f, slots, cardSlots: cardSlotsOf(slots), card: SENTENCE_FORMULAS.find((c) => c.sentence === f.example)?.card };
  });
  return listed;
}

export interface Reading { sentence: string; slots: string[]; code: string; exact: Listed[]; close: Listed[] }

export function readFormula(sentence: string): Reading | null {
  const mine = sentenceSlots(tagForCheck(sentence), sentence);
  if (!mine.length) return null;
  const code = formulaCode(mine, sentence);
  const bare = (c: string) => c.replace(/\*$/, '');
  // A contraction formula (You're: P'V) only matches a sentence with that contraction, and the other way round.
  const sameShape = (f: Listed) => f.code.includes("'") === code.includes("'");
  const ranked = listedFormulas().map((f) => ({ f, d: bare(f.code) === code ? 0 : slotDistance(f.cardSlots, mine) + (sameShape(f) ? 0 : 1) }))
    .sort((x, y) => x.d - y.d);
  // Each formula code shows once (her request 2026-11-12): rows of her list with the same code become one card that
  // lists every way it is used. A code that matches is never shown again under Close formulas.
  const merge = (list: Listed[]): Listed[] => {
    const byCode = new Map<string, Listed[]>();
    for (const f of list) byCode.set(bare(f.code), [...(byCode.get(bare(f.code)) ?? []), f]);
    return [...byCode.values()].map((g) => ({ ...g[0], uses: listedFormulas().filter((x) => bare(x.code) === bare(g[0].code)) }));
  };
  const exact = merge(ranked.filter((r) => r.d === 0).map((r) => r.f));
  const exactCodes = new Set(exact.map((f) => bare(f.code)));
  return {
    sentence,
    slots: cardSlotsOf(mine),
    code,
    exact,
    close: merge(ranked.filter((r) => r.d > 0 && r.d <= 1 && !exactCodes.has(bare(r.f.code))).map((r) => r.f)).slice(0, 3),
  };
}


// Forget the list's patterns (after a teacher correction changes how example sentences read).
export const resetListed = () => { listed = null; };
