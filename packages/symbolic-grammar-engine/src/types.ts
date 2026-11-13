// Small shared types for the engine.
export type GrammarWordClass = 'noun' | 'verb';
// A noun or verb piece of the board's original sandbox lists (its verbs are part of the engine's word list).
export interface GrammarPiece {
  id: string;
  text: string;
  wordClass: GrammarWordClass;
  number: 'singular' | 'plural';
}
