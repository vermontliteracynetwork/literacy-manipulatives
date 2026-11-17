import { MASTER_FORMULAS } from './masterList';

// Her formula list for every Literacy Manipulatives tool (her request 2026-11-17: "use this universally in all
// literacy manipulatives programs"): her master list, "All Formulas" (src/lib/writer/masterList.ts, made by
// scripts/import-master-list.py from her PDF). Each formula has its code, levels, formula (the symbols in order),
// model sentence and required words, plus its unit, skill, shorthand name and purpose. The same change for the
// engine itself is ready in docs/engine-1.3.0-master-list.patch.
export interface ListedFormula {
  code: string; levels: string[]; breakdown: string; example: string; required: string;
  unit: string; skill: string; name: string; purpose: string;
}

export const FORMULA_LIST: ListedFormula[] = MASTER_FORMULAS.map((f) => ({
  code: f.code, levels: f.levels, breakdown: f.formula, example: f.sentence, required: f.required,
  unit: f.unit, skill: f.skill, name: f.name, purpose: f.purpose,
}));
