import { tagEngine } from './sentenceCheck';
import { formulaCode, sentenceSlots } from './formulaMatch';
import { FORMULA_LIST } from './formulaList';
import { TAG_TESTS } from './engineTests';
import type { SymbolWordClass } from '../grammarSymbols';

// Checks the grammar engine (her request 2026-11-13: a strong logic behind the mark ups and grammar symbols for all
// programs): every hand-checked test sentence word by word, and every example in her All Sentence Formulas list by
// its formula code. Formula Search's passage tab shows the result.
export interface EngineCheck {
  tags: { pass: number; total: number; misses: { sentence: string; got: SymbolWordClass[]; expect: SymbolWordClass[] }[] };
  codes: { pass: number; total: number; misses: { sentence: string; got: string; expect: string }[] };
}
export function checkEngine(): EngineCheck {
  const tagMisses: EngineCheck['tags']['misses'] = [];
  for (const t of TAG_TESTS) {
    const got = tagEngine(t.sentence).map((w) => w.wordClass);
    if (got.join() !== t.expect.join()) tagMisses.push({ sentence: t.sentence, got, expect: t.expect });
  }
  const codeMisses: EngineCheck['codes']['misses'] = [];
  for (const f of FORMULA_LIST) {
    const text = f.example.replace(/[“”]/g, '"');
    const got = formulaCode(sentenceSlots(tagEngine(text), text), text);
    if (got !== f.code.replace(/\*$/, '')) codeMisses.push({ sentence: f.example, got, expect: f.code });
  }
  return {
    tags: { pass: TAG_TESTS.length - tagMisses.length, total: TAG_TESTS.length, misses: tagMisses },
    codes: { pass: FORMULA_LIST.length - codeMisses.length, total: FORMULA_LIST.length, misses: codeMisses },
  };
}
