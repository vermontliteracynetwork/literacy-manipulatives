import type { AssessmentDef, ColumnKey, LevelDef } from './types';

// Scoring math for any assessment written as an AssessmentDef. Pure functions, no React.

export type Mark = '' | 'y' | 'n';
export type Rating = 'priority' | 'developing' | 'secure';
export type Use = '' | 'pretest' | 'mid-check' | 'posttest' | 'benchmark';

export interface RowData {
  /** count columns, raw input text */
  n: Partial<Record<ColumnKey, string>>;
  /** check columns */
  m: Partial<Record<ColumnKey, Mark>>;
  /** skill columns, correct / used as raw input text */
  s: Partial<Record<ColumnKey, { c: string; u: string }>>;
}

export interface ScoringRecord {
  id: string;
  assessmentId: string;
  levelId: string;
  learner: string;
  date: string;
  assessor: string;
  use: Use;
  responseMode: string;
  notes: string;
  rows: Record<string, RowData[]>;
  /** "column:lesson" to checked */
  teach: Record<string, boolean>;
  /** lesson code to the teacher's own rating, overriding the suggestion */
  lessonRatings: Record<string, Rating | ''>;
  updatedAt: number;
}

export const USES: { value: Use; label: string }[] = [
  { value: 'pretest', label: 'Pretest' },
  { value: 'mid-check', label: 'Mid-check' },
  { value: 'posttest', label: 'Posttest' },
  { value: 'benchmark', label: 'Benchmark' },
];

export const RATING_LABEL: Record<Rating, string> = { priority: 'Priority', developing: 'Developing', secure: 'Secure' };

export function emptyRow(): RowData {
  return { n: {}, m: {}, s: {} };
}

export function emptyRows(level: LevelDef): Record<string, RowData[]> {
  const out: Record<string, RowData[]> = {};
  for (const q of level.questions) out[q.id] = level.rows.map(() => emptyRow());
  return out;
}

export function newRecord(def: AssessmentDef, levelId: string): ScoringRecord {
  const level = def.levels.find((l) => l.id === levelId) ?? def.levels[0];
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    assessmentId: def.id,
    levelId: level.id,
    learner: '',
    date: new Date().toISOString().slice(0, 10),
    assessor: '',
    use: '',
    responseMode: '',
    notes: '',
    rows: emptyRows(level),
    teach: {},
    lessonRatings: {},
    updatedAt: Date.now(),
  };
}

export function num(v: string | undefined): number | null {
  if (v == null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function rowHasData(r: RowData | undefined): boolean {
  if (!r) return false;
  return (
    Object.values(r.n).some((v) => num(v) != null) ||
    Object.values(r.m).some((v) => v === 'y' || v === 'n') ||
    Object.values(r.s).some((v) => num(v?.c) != null || num(v?.u) != null)
  );
}

/** Complete sentence is ✗ whenever Capital or End mark is ✗. */
export function effectiveMark(r: RowData, key: ColumnKey): Mark {
  if (key === 'complete' && (r.m.capital === 'n' || r.m.endMark === 'n')) return 'n';
  return r.m[key] ?? '';
}

export function rating(pct: number | null): Rating | null {
  if (pct == null) return null;
  if (pct < 60) return 'priority';
  if (pct < 90) return 'developing';
  return 'secure';
}

const RANK: Record<Rating, number> = { priority: 0, developing: 1, secure: 2 };
function worst(a: Rating | null, b: Rating | null): Rating | null {
  if (!a) return b;
  if (!b) return a;
  return RANK[a] <= RANK[b] ? a : b;
}

/** a / b for any column over a set of rows. count: sum / rows with a number. check: ✓ / rows scored. skill: correct / used. */
export interface Tally { a: number; b: number }

export interface ColumnResult extends Tally { key: ColumnKey; pct: number | null }

export interface QuestionResult {
  id: string;
  totals: Record<ColumnKey, Tally>;
  score: number;
  target: number;
  met: boolean;
  scored: number; // rows with any data
}

export interface Summary {
  sentences: number;
  avgWords: number | null;
  shortest: number | null;
  longest: number | null;
  requiredUsed: number;
  requiredSentences: number;
  columns: Record<ColumnKey, ColumnResult>;
  questions: QuestionResult[];
  targetTotal: number;
  targetMax: number;
}

function tallyRows(def: AssessmentDef, rows: RowData[]): Record<ColumnKey, Tally> {
  const out = {} as Record<ColumnKey, Tally>;
  const scored = rows.filter(rowHasData);
  for (const col of def.columns) {
    const t: Tally = { a: 0, b: 0 };
    if (col.kind === 'count') {
      for (const r of scored) {
        const v = num(r.n[col.key]);
        if (v != null) { t.a += v; t.b += 1; }
      }
    } else if (col.kind === 'check') {
      for (const r of scored) if (effectiveMark(r, col.key) === 'y') t.a += 1;
      t.b = scored.length;
    } else {
      for (const r of scored) {
        t.a += num(r.s[col.key]?.c) ?? 0;
        t.b += num(r.s[col.key]?.u) ?? 0;
      }
    }
    out[col.key] = t;
  }
  return out;
}

export function summarize(def: AssessmentDef, level: LevelDef, rows: Record<string, RowData[]>): Summary {
  const all: RowData[] = [];
  let requiredUsed = 0;
  let requiredSentences = 0;
  const questions: QuestionResult[] = level.questions.map((q) => {
    const qRows = rows[q.id] ?? [];
    all.push(...qRows);
    level.rows.forEach((kind, i) => {
      if (kind !== 'Required') return;
      requiredSentences += 1;
      if ((num(qRows[i]?.n.requiredWords) ?? 0) >= 1) requiredUsed += 1;
    });
    const totals = tallyRows(def, qRows);
    const score = totals[q.scoredIn]?.a ?? 0;
    return { id: q.id, totals, score, target: q.target, met: score >= q.target, scored: qRows.filter(rowHasData).length };
  });

  const t = tallyRows(def, all);
  const columns = {} as Record<ColumnKey, ColumnResult>;
  for (const c of def.columns) {
    const { a, b } = t[c.key];
    let pct: number | null = null;
    if (c.key === 'requiredWords') pct = requiredSentences ? (requiredUsed / requiredSentences) * 100 : null;
    else if (c.kind !== 'count') pct = b ? (a / b) * 100 : null;
    columns[c.key] = { key: c.key, a, b, pct };
  }

  const lengths = all.filter(rowHasData).map((r) => num(r.n.totalWords)).filter((v): v is number => v != null && v > 0);
  return {
    sentences: all.filter(rowHasData).length,
    avgWords: lengths.length ? lengths.reduce((s, v) => s + v, 0) / lengths.length : null,
    shortest: lengths.length ? Math.min(...lengths) : null,
    longest: lengths.length ? Math.max(...lengths) : null,
    requiredUsed,
    requiredSentences,
    columns,
    questions,
    targetTotal: questions.reduce((s, q) => s + q.score, 0),
    targetMax: level.questions.reduce((s, q) => s + q.target, 0),
  };
}

export interface LessonPlanRow {
  code: string;
  title: string;
  columns: ColumnKey[];
  targets: { id: string; met: boolean; attempted: boolean }[];
  suggested: Rating | null;
  checked: boolean;
}

/** Every lesson named on the summary page, with a suggested rating: the lowest rating among the columns that
 *  list it, and at least Developing when its target question was missed. */
export function lessonPlan(def: AssessmentDef, level: LevelDef, sum: Summary, teach: Record<string, boolean>): LessonPlanRow[] {
  const byCode = new Map<string, LessonPlanRow>();
  const get = (code: string) => {
    let row = byCode.get(code);
    if (!row) {
      row = { code, title: def.lessons[code] ?? '', columns: [], targets: [], suggested: null, checked: false };
      byCode.set(code, row);
    }
    return row;
  };
  for (const c of def.columns) {
    for (const code of level.teachNext[c.key] ?? []) {
      const row = get(code);
      row.columns.push(c.key);
      row.suggested = worst(row.suggested, rating(sum.columns[c.key].pct));
      if (teach[`${c.key}:${code}`]) row.checked = true;
    }
  }
  for (const q of level.questions) {
    const res = sum.questions.find((r) => r.id === q.id);
    const row = get(q.lesson);
    const attempted = (res?.scored ?? 0) > 0;
    row.targets.push({ id: q.id, met: !!res?.met, attempted });
    if (attempted && !res?.met) row.suggested = worst(row.suggested, 'developing');
  }
  return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}

export function pctText(p: number | null): string {
  return p == null ? '' : `${Math.round(p)}%`;
}
