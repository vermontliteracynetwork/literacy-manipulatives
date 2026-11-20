// What the Symbolic Grammar log shows (her request 2026-11-20): how often each formula appears and in which kinds of
// text, sentences with no formula in her list grouped by pattern, the structures that are not sentences, and every
// word with its symbol and real example sentences. Beth's six questions score a formula for teaching it as a formula;
// she approves.

import type { LineType } from 'symbolic-grammar-engine/src/writer/passage';
import type { SymbolWordClass } from '../grammarSymbols';
import type { CorpusItem, CorpusSource, FormulaReview, TextKind } from './store';

export type Level = 'full' | 'core' | 'job';
export interface FormulaRow {
  code: string; count: number; share: number; sources: number; kinds: TextKind[]; learner: number; everyday: number;
  inList: boolean; examples: { text: string; source: string }[]; closest: string[];
}

const pick = (it: CorpusItem, level: Level) => {
  const code = it.inList ? it.listed : it.code;
  if (level === 'full') return code;
  const fam = it.family.length ? it.family : [code];
  return level === 'job' ? fam[0] : fam[1] ?? fam[0];
};

export function formulaRows(items: CorpusItem[], sources: CorpusSource[], level: Level, kind: TextKind | 'all'): FormulaRow[] {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const use = items.filter((i) => i.type === 'sentence' && i.code && (kind === 'all' || byId.get(i.sourceId)?.textKind === kind));
  const m = new Map<string, FormulaRow & { srcSet: Set<string>; kindSet: Set<TextKind> }>();
  for (const it of use) {
    const code = pick(it, level);
    const src = byId.get(it.sourceId);
    const row = m.get(code) ?? { code, count: 0, share: 0, sources: 0, kinds: [], learner: 0, everyday: 0, inList: level === 'full' ? it.inList : true, examples: [], closest: it.closest, srcSet: new Set(), kindSet: new Set() };
    row.count++;
    if (src) { row.srcSet.add(src.id); row.kindSet.add(src.textKind); if (src.textKind === 'learner') row.learner++; if (src.textKind === 'everyday') row.everyday++; }
    if (row.examples.length < 3 && !row.examples.some((e) => e.text === it.text)) row.examples.push({ text: it.text, source: src?.title ?? '' });
    m.set(code, row);
  }
  return [...m.values()].map(({ srcSet, kindSet, ...r }) => ({ ...r, share: use.length ? r.count / use.length : 0, sources: srcSet.size, kinds: [...kindSet] }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}

export interface StructureRow { type: LineType | 'dialogue' | 'informal speech'; count: number; examples: string[] }
export function structureRows(items: CorpusItem[]): StructureRow[] {
  const m = new Map<StructureRow['type'], StructureRow>();
  const add = (type: StructureRow['type'], text: string) => {
    const r = m.get(type) ?? { type, count: 0, examples: [] };
    r.count++; if (r.examples.length < 4 && !r.examples.includes(text)) r.examples.push(text);
    m.set(type, r);
  };
  for (const it of items) {
    add(it.type, it.text);
    if (it.dialogue) add('dialogue', it.text);
    if (it.informal) add('informal speech', it.text);
  }
  return [...m.values()].sort((a, b) => b.count - a.count);
}

export interface WordRow { word: string; symbol: SymbolWordClass; count: number; examples: { text: string; source: string }[] }
export function wordRows(items: CorpusItem[], sources: CorpusSource[]): WordRow[] {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const m = new Map<string, WordRow>();
  for (const it of items) {
    if (it.type !== 'sentence') continue;
    for (const [w, c] of it.words) {
      const word = w.toLowerCase();
      const k = `${word}|${c}`;
      const r = m.get(k) ?? { word, symbol: c, count: 0, examples: [] };
      r.count++;
      // Learner writing never becomes an example sentence (it stays private).
      const src = byId.get(it.sourceId);
      if (src && src.origin === 'public' && r.examples.length < 3 && !r.examples.some((e) => e.text === it.text)) r.examples.push({ text: it.text, source: src.title });
      m.set(k, r);
    }
  }
  return [...m.values()].sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

// Beth's six questions (her rule 2026-11-20). Two are read from the log; four are her answers.
export interface Score { common: boolean; needed: boolean; answered: number; yes: number; advice: 'Teach as a formula' | 'Teach as craft, not a formula' | 'Keep collecting' }
export function scoreFormula(row: FormulaRow, review?: FormulaReview): Score {
  const common = row.kinds.filter((k) => k !== 'learner').length >= 2 && row.sources >= 3;
  const needed = row.learner > 0 || row.everyday > 0;
  const hers = [review?.fixed, review?.symbols, review?.order, review?.standard];
  const answered = hers.filter((x) => x !== undefined).length;
  const yes = [common, needed, ...hers].filter((x) => x === true).length;
  const advice = review?.fixed === false ? 'Teach as craft, not a formula' : yes >= 5 ? 'Teach as a formula' : 'Keep collecting';
  return { common, needed, answered, yes, advice };
}

export function csv(rows: (string | number)[][]): string {
  const q = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
  return rows.map((r) => r.map(q).join(',')).join('\n');
}
export function download(name: string, text: string, type = 'text/csv') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
