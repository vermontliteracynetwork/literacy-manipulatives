// Minimal, standalone type set for the Literacy Manipulatives board —
// trimmed from the Homeplot dashboard's full src/types.ts to just what
// this tool's content libraries and board actually use. No student,
// account, or marketplace types here on purpose: this v1 has no login
// and nothing is saved.

export interface TTSSettings {
  rate: number; // 0.5 - 1.5
  voiceURI: string | null;
}

export type GrammarWordClass = 'noun' | 'verb';

export const GRAMMAR_WORD_CLASS_COLORS: Record<GrammarWordClass, string> = {
  noun: '#F6C445', // yellow — subject/who is always yellow
  verb: '#E4572E', // coral-red
};

export const GRAMMAR_WORD_CLASS_TEXT_COLORS: Record<GrammarWordClass, string> = {
  noun: '#241a05',
  verb: '#241a05',
};

// One draggable piece on the open canvas. `number` is what the snap
// mechanic checks — a noun and a verb only click together when these
// match (subject-verb agreement), the one grammar rule the sandbox
// quietly enforces while everything else stays completely free.
export interface GrammarPiece {
  id: string;
  text: string;
  wordClass: GrammarWordClass;
  number: 'singular' | 'plural';
}
