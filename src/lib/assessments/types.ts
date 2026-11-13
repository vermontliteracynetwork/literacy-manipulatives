// Symbolic Grammar assessment scoring: the shape every unit's score sheet is written in.
// Add a unit by writing one AssessmentDef (see unit1.ts) and listing it in index.ts. The scoring screen,
// totals, percents, summary and "what to teach" all come from this data, so nothing else needs to change.

export type ColumnKey =
  | 'totalWords'
  | 'requiredWords'
  | 'capital'
  | 'endMark'
  | 'complete'
  | 'articles'
  | 'verbWho'
  | 'pastFuture'
  | 'names'
  | 'plural'
  | 'apostrophes'
  | 'pronouns'
  | 'homophones';

/** count: a number (#). check: a check or an x. skill: correct / used. */
export type ColumnKind = 'count' | 'check' | 'skill';

export interface ColumnDef {
  key: ColumnKey;
  label: string;
  kind: ColumnKind;
  /** Small grey examples or notes under the heading, as on the paper sheet. */
  hint?: string;
}

export type RowKind = 'Required' | 'Goal' | 'Extending';

export interface QuestionDef {
  id: string; // "Q1"
  skill: string; // target skill name
  lesson: string; // lesson code, e.g. "1.1.1"
  requiredWords: string;
  scoredIn: ColumnKey; // the outlined target cell's column
  target: number; // the printed required number in the outlined cell
}

export interface LevelDef {
  id: string; // "A"
  /** Sentence rows under every question, in order. */
  rows: RowKind[];
  questions: QuestionDef[];
  /** Summary page "Teach next": lesson codes for each column. */
  teachNext: Partial<Record<ColumnKey, string[]>>;
}

export interface AssessmentDef {
  id: string; // "unit1"
  title: string; // "Unit 1"
  /** Lesson code to lesson name. */
  lessons: Record<string, string>;
  columns: ColumnDef[];
  levels: LevelDef[];
  /** The "how to score" guide page. */
  guide: { heading: string; points: string[] }[];
}
