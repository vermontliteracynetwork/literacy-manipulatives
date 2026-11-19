import { BREAKDOWN_FORMULAS, fitsJob, formulaPartsOf, jobsOfWord, type SymbolWordClass } from 'symbolic-grammar-engine';
import { GRAMMAR_SYMBOL_INFO } from '../grammarSymbols';
import { tagForCheck } from '../writer/sentenceCheck';
import { formulaCode, sentenceSlots } from '../writer/formulaMatch';
import { MASTER_FORMULAS } from '../writer/masterList';
import { tenseVersions } from '../writer/tenses';
import type { Activity } from './types';
import type { Blank } from '../silly/blanks';

// Every check a lesson activity makes goes through the Symbolic Grammar Engine, so the lesson grades a word's job
// and a sentence's formula exactly the way the curriculum does.

export type Resp = Record<string, unknown>;
export const SYMBOL_ORDER: SymbolWordClass[] = ['article', 'adjective', 'noun', 'propernoun', 'pronoun', 'verb', 'adverb', 'preposition', 'conjunction', 'interjection'];
export const symbolName = (c: SymbolWordClass) => GRAMMAR_SYMBOL_INFO[c]?.name ?? c;
export const symbolByName = (raw: string): SymbolWordClass | undefined => {
  const t = raw.trim().toLowerCase().replace(/\s+/g, '');
  return SYMBOL_ORDER.find((c) => c === t || symbolName(c).toLowerCase().replace(/\s+/g, '') === t);
};

export const formulaRow = (code: string) => MASTER_FORMULAS.find((m) => m.code === code);
// Her Lesson Breakdown is the most current list: a code that is only there still gets its example and parts of speech.
const breakdownRow = (code: string) => BREAKDOWN_FORMULAS.find((f) => f.code === code);
export const formulaLabel = (code: string) => { const b = breakdownRow(code); const ex = b?.example ?? formulaRow(code)?.sentence ?? ''; const parts = formulaPartsOf(code, ex); return ex ? `${code} ${ex} (${parts.split(/\s+/).filter(Boolean).join(' + ')})` : code; };
export const formulaSlots = (code: string): string[] => (formulaRow(code)?.formula ?? formulaPartsOf(code, breakdownRow(code)?.example ?? '')).replace(/proper noun/g, 'propernoun').split(/\s+/).filter(Boolean);

/** Her formula code for a sentence a student wrote. */
export function codeOf(text: string): string {
  const t = text.trim();
  if (!t) return '';
  try { return formulaCode(sentenceSlots(tagForCheck(t), t), t); } catch { return ''; }
}
export const hasCapital = (t: string) => /^[^A-Za-z]*[A-Z]/.test(t.trim());
export const hasPunctuation = (t: string) => /[.!?]["”']?$/.test(t.trim());

export interface SentenceResult { capital: boolean; punctuation: boolean; code: string; formula?: boolean; ok: boolean }
export function checkWritten(text: string, wantCodes: string[] = [], mode: 'formula' | 'sentence' | 'none' = 'formula'): SentenceResult | null {
  const t = text.trim();
  if (!t || mode === 'none') return null;
  const code = codeOf(t);
  const capital = hasCapital(t), punctuation = hasPunctuation(t);
  const formula = mode === 'formula' && wantCodes.length ? wantCodes.includes(code) : undefined;
  return { capital, punctuation, code, formula, ok: capital && punctuation && formula !== false };
}

/** The symbol a word gets on its own (the first job the engine lists). */
export const symbolOf = (word: string): SymbolWordClass | undefined => jobsOfWord(word.replace(/[^A-Za-z'-]/g, ''))[0];
export const wordFits = (word: string, cls: SymbolWordClass) => fitsJob(word.replace(/[^A-Za-z'-]/g, ''), cls);

/** Each word of a sentence and its symbol, read in context. */
export const symbolsOfSentence = (s: string) => tagForCheck(s).map((w) => ({ word: w.word, cls: w.wordClass }));

export const tensesOf = (s: string) => tenseVersions(s);

// Lines like "word = noun" or "prompt | a / b | answer".
export const splitEq = (line: string): [string, string] => { const i = line.lastIndexOf(' = '); return i < 0 ? [line.trim(), ''] : [line.slice(0, i).trim(), line.slice(i + 3).trim()]; };
export const splitArrow = (line: string): [string, string] => { const i = line.indexOf('=>'); return i < 0 ? [line.trim(), ''] : [line.slice(0, i).trim(), line.slice(i + 2).trim()]; };
export const splitBar = (line: string) => line.split('|').map((x) => x.trim());

export const strs = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
export const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
export const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
export const syms = (v: unknown): SymbolWordClass[] => strs(v).filter((x): x is SymbolWordClass => SYMBOL_ORDER.includes(x as SymbolWordClass));

// The cards of a sort and where each one belongs.
export interface SortCat { id: string; label: string; cls?: SymbolWordClass; code?: string }
export function sortSetup(data: Record<string, unknown>): { cats: SortCat[]; items: { text: string; cat: string; ok: string[] }[] } {
  const mode = str(data.mode) || 'symbols';
  const cats: SortCat[] = mode === 'formulas' ? strs(data.formulas).map((c) => ({ id: c, label: formulaLabel(c), code: c }))
    : mode === 'labels' ? strs(data.labels).map((l) => ({ id: l, label: l }))
    : syms(data.symbols).map((c) => ({ id: c, label: symbolName(c), cls: c }));
  const items = strs(data.items).filter(Boolean).map((line) => {
    const [text, given] = splitEq(line);
    let cat = '';
    if (given) cat = mode === 'symbols' ? (symbolByName(given) ?? given) : given;
    else if (mode === 'symbols') { const jobs = jobsOfWord(text.replace(/[^A-Za-z'-]/g, '')); cat = cats.find((c) => c.cls && jobs.includes(c.cls))?.id ?? jobs[0] ?? ''; }
    else if (mode === 'formulas') cat = codeOf(text);
    // A word that can do more than one job may go under any of its symbols ("run" is a noun or a verb).
    const ok = !given && mode === 'symbols' ? cats.filter((c) => c.cls && wordFits(text, c.cls) === 'yes').map((c) => c.id) : [];
    return { text, cat, ok: ok.length ? ok : cat ? [cat] : [] };
  });
  return { cats, items };
}

/** A short summary of a student's work on one activity, and how much was right (when it can be checked). */
export function summarize(a: Activity, resp: Resp | undefined): { text: string; right?: number; total?: number } {
  const r = resp ?? {};
  const d = a.data;
  switch (a.engine) {
    case 'symbolMatch': {
      const s = syms(d.symbols); const right = s.filter((c) => r[c] === c).length;
      return { text: s.map((c) => `${symbolName(c)}: ${r[c] ? symbolName(r[c] as SymbolWordClass) : '-'}`).join('; '), right, total: s.length };
    }
    case 'sort': {
      const { items } = sortSetup(d); const right = items.filter((it, i) => it.ok.includes(str(r[i]))).length;
      return { text: items.map((it, i) => `${it.text} → ${str(r[i]) || '-'}`).join('; '), right, total: items.length };
    }
    case 'define': return { text: syms(d.symbols).map((c) => `${symbolName(c)}: ${str(r[c]) || '-'}`).join('; ') };
    case 'wordList': {
      let right = 0, total = 0;
      const text = syms(d.symbols).map((c) => { const w = strs(r[c]).filter(Boolean); total += w.length; right += w.filter((x) => wordFits(x, c) === 'yes').length; return `${symbolName(c)}: ${w.join(', ') || '-'}`; }).join('; ');
      return { text, right, total };
    }
    case 'memory': return { text: `${strs(r.found).length} of ${strs(d.pairs).length} pairs found`, right: strs(r.found).length, total: strs(d.pairs).length };
    case 'pull': return { text: strs(r.answers).map((x, i) => `${strs(r.pulled)[i] ?? ''}: ${x}`).join('; ') || '-' };
    case 'build': {
      const items = strs(d.items); const unit = str(d.unit);
      if (unit === 'sentences') { const order = strs(r.order); const ok = order.length === items.length && order.every((x, i) => x === items[i]); return { text: order.join(' ') || '-', right: ok ? 1 : 0, total: 1 }; }
      const right = items.filter((s, i) => strs(r[i]).join(' ') === s.replace(/\s+/g, ' ').trim()).length;
      return { text: items.map((_, i) => strs(r[i]).join(' ') || '-').join(' | '), right, total: items.length };
    }
    case 'write': case 'assess': {
      const lines = strs(r.lines).filter(Boolean);
      const want = a.engine === 'assess' ? strs(d.items).map((l) => splitBar(l)[1] ?? '') : strs(d.formulas);
      const mode = a.engine === 'assess' ? 'formula' : ((str(d.check) || 'formula') as 'formula' | 'sentence' | 'none');
      const res = strs(r.lines).map((l, i) => checkWritten(l, a.engine === 'assess' ? (want[i] ? [want[i]] : []) : want, mode));
      const checked = res.filter(Boolean) as SentenceResult[];
      const ask = checked.filter((x) => x.formula === false).length;
      return { text: `${lines.join(' / ') || '-'}${ask ? ` (formula to check: ${ask})` : ''}`, right: checked.filter((x) => x.ok).length, total: mode === 'none' ? undefined : a.engine === 'assess' ? strs(d.items).length : Math.max(checked.length, num(d.lines, 1)) };
    }
    case 'fill': return { text: str(r.story) || '-' };
    case 'pyramid': return { text: strs(r.lines).filter(Boolean).join(' / ') || Object.values(r).map(str).filter(Boolean).join(', ') || '-' };
    case 'edit': {
      const items = strs(d.items).map(splitArrow); const right = items.filter(([, ok], i) => ok && str(r[i]).trim() === ok.trim()).length;
      return { text: items.map((_, i) => str(r[i]) || '-').join(' | '), right, total: items.length };
    }
    case 'time': return { text: strs(d.sentences).map((_, i) => ['past', 'present', 'future'].map((k) => str((r[i] as Resp | undefined)?.[k])).join(' / ')).join(' | ') || '-' };
    case 'choice': {
      const items = strs(d.items).map(splitBar); const right = items.filter((it, i) => it[2] && r[i] === it[2]).length;
      return { text: items.map((_, i) => str(r[i]) || '-').join(' | '), right, total: items.length };
    }
    case 'markup': {
      let right = 0, total = 0;
      const text = strs(d.sentences).map((s, i) => { const key = symbolsOfSentence(s); const mine = (r[i] ?? {}) as Resp; key.forEach((w, j) => { if (mine[j]) { total++; if (mine[j] === w.cls || wordFits(w.word, mine[j] as SymbolWordClass) === 'yes') right++; } }); return key.map((w, j) => `${w.word}(${mine[j] ? symbolName(mine[j] as SymbolWordClass) : '-'})`).join(' '); }).join(' | ');
      return { text, right, total };
    }
    case 'tictactoe': { const won = Object.values((r.squares ?? {}) as Resp).filter(Boolean).length; return { text: `${won} squares claimed`, right: won, total: 9 }; }
    case 'fishing': return { text: strs(r.done).join(' / ') || '-', right: strs(r.done).length, total: num(d.goal, 3) };
    case 'search': return { text: `${strs(r.found).length} of ${strs(d.words).length} words found. ${str(r.sentence)}`, right: strs(r.found).length, total: strs(d.words).length };
    case 'procA': return { text: strs(r.lines).filter(Boolean).join(' / ') || '-' };
    case 'madlib': {
      const blanks = (Array.isArray(d.blanks) ? d.blanks : []) as Blank[];
      const w = (r.w ?? {}) as Record<string, string>;
      const filled = blanks.filter((_, n) => str(w[n]).trim()).length;
      const right = blanks.filter((b, n) => str(w[n]).trim() && b.kind !== 'number' && wordFits(str(w[n]), b.cls) === 'yes').length;
      return { text: `${filled} of ${blanks.length} words: ${blanks.map((_, n) => str(w[n]) || '_').join(', ')}`, right, total: blanks.filter((b) => b.kind !== 'number').length };
    }
    default: return { text: '' };
  }
}
