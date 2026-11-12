import type { SymbolWordClass } from '../grammarSymbols';
import type { BoardData } from '../../LiteracyManipulatives';

// Daily Procedure (her request 2026-11-12): a lesson as a set of steps, one page each, shown as tabs on the left.
// A page is either a set template (Goal, Review symbols, Formula instruction, Activity, Assessment) or a custom
// design, which is a whiteboard with all the board's materials. Every page also has its own whiteboard, and
// teacher notes that only show in Edit mode (Learn mode is what students see on a shared screen).

export type PageKind = 'goal' | 'review-symbols' | 'formula' | 'activity' | 'assessment' | 'custom';

export interface GoalData { agenda: string[]; goal: string; closing?: string }
export interface ReviewSymbol { cls: SymbolWordClass; motion: string; words: string[] }
export interface ReviewData { directions: string[]; symbols: ReviewSymbol[]; timerSeconds: number }
export interface Block { label: string; lines: string[] }
export interface FormulaData { lesson: string; name: string; codes: string[]; blocks: Block[] }
export interface Pile { label: string; cards: string[] }
export interface ActivityData { directions: string[]; examples: string[]; piles: Pile[] }
export interface AssessItem { prompt: string; skill: string; answer: string }
export interface AssessmentData { intro: string; items: AssessItem[]; checks: string[] }

export type PageData = GoalData | ReviewData | FormulaData | ActivityData | AssessmentData | Record<string, never>;

// Her daily intervention routine (2026-11-12): every step belongs to one of these phases.
export type Phase = 'Opening' | 'Review' | 'Instruction' | 'Practice' | 'Application' | 'Assessment';
export const PHASES: { name: Phase; about: string }[] = [
  { name: 'Opening', about: 'Goal and agenda.' },
  { name: 'Review', about: "Review symbols used in the day's lesson(s); create a list of 3 to 5 words for each symbol used." },
  { name: 'Instruction', about: 'Explicit instruction procedure for new formulas; repeat for all new formulas.' },
  { name: 'Practice', about: 'Select an activity where student and teacher practice together.' },
  { name: 'Application', about: 'Independent or less-support reinforcement activity.' },
  { name: 'Assessment', about: 'Formative assessment.' },
];
export const PHASE_FOR_KIND: Record<PageKind, Phase> = {
  goal: 'Opening', 'review-symbols': 'Review', formula: 'Instruction', activity: 'Practice', assessment: 'Assessment', custom: 'Practice',
};

export interface ProcPage {
  id: string;
  phase?: Phase;
  title: string;      // the step name on its tab: "Review symbols"
  minutes?: string;   // "5 to 8 min"
  kind: PageKind;
  data: PageData;
  notes: string;      // teacher notes (Edit mode only)
  board: BoardData;   // the page's whiteboard
}

export interface Procedure {
  id: string;
  title: string;
  subtitle?: string;
  folderId: string | null;
  pages: ProcPage[];
  updatedAt: string;
  saved?: boolean;    // in the library (the teacher chose to save it)
}

export interface Folder { id: string; name: string }

export const KIND_NAMES: Record<PageKind, string> = {
  goal: 'Goal', 'review-symbols': 'Review symbols', formula: 'Formula instruction', activity: 'Activity',
  assessment: 'Assessment', custom: 'Custom design (whiteboard)',
};

export const newId = () => Math.random().toString(36).slice(2, 10);
export const emptyBoard = (): BoardData => ({ placed: [], strokes: [] });

export function blankData(kind: PageKind): PageData {
  switch (kind) {
    case 'goal': return { agenda: ['Review', 'Learn', 'Practice', 'Do it', 'Check'], goal: 'Today I can ' };
    case 'review-symbols': return { directions: ['Name it. Show the motion. Give me a word.'], symbols: [{ cls: 'noun', motion: '', words: [] }], timerSeconds: 30 };
    case 'formula': return { lesson: '', name: '', codes: [], blocks: [{ label: 'I do', lines: [] }, { label: 'We do', lines: [] }, { label: 'You do', lines: [] }, { label: 'Check', lines: [] }] };
    case 'activity': return { directions: ['Activity name', 'First step.'], examples: [], piles: [] };
    case 'assessment': return { intro: '', items: [], checks: ['Formula', 'Capital', 'End mark'] };
    default: return {};
  }
}

export function newPage(kind: PageKind, title = KIND_NAMES[kind], phase: Phase = PHASE_FOR_KIND[kind]): ProcPage {
  return { id: newId(), title, kind, phase, data: blankData(kind), notes: '', board: emptyBoard() };
}
export const phaseOf = (p: ProcPage): Phase => p.phase ?? PHASE_FOR_KIND[p.kind];

// A new procedure has every phase of the routine ready to fill in.
export function routinePages(): ProcPage[] {
  return [
    newPage('goal', 'Goal'),
    newPage('review-symbols', 'Review symbols'),
    newPage('formula', 'New formula'),
    newPage('activity', 'Practice together', 'Practice'),
    newPage('activity', 'Application', 'Application'),
    newPage('assessment', 'Assessment'),
  ];
}
