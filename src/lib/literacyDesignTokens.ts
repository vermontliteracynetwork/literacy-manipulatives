// Literacy Manipulatives — design-tokens color/symbol source (A23-ROADMAP
// Phase 0, "extract one design-tokens color/symbol source"). The gap
// analysis flagged that montessoriGrammar.ts's palette and types.ts's
// GRAMMAR_WORD_CLASS_COLORS both assign colors to "noun"/"verb" but
// disagree (e.g. noun is red-triangle in one, yellow in the other).
//
// Judgment call, logged per the roadmap's own instruction to make the
// smallest reversible call rather than stall: these are NOT the same
// design decision reused twice by accident — they are two genuinely
// separate, both teacher-specified systems for two different tile kinds
// that happen to share the English word "noun":
//   1. MONTESSORI_WORD_CLASS_INFO (montessoriGrammar.ts) — the 9-class
//      real Montessori shape+color symbol set (Grammar Symbols category),
//      colors pixel-measured from the teacher's own uploaded artwork.
//   2. GRAMMAR_WORD_CLASS_COLORS (types.ts) — the older 2-class
//      noun/verb WORD-TILE palette (the dormant "Sentence Grammar"
//      category, content kept in code but not reachable from the
//      sidebar per direct teacher instruction), built to her own direct
//      spec ("subject/who is always yellow").
// Overwriting either to match the other would silently reverse a real,
// separate teacher instruction. So rather than merging the two palettes,
// this file is the single place both are re-exported from, documented
// side by side, so nothing new gets written against a third, invented
// palette — and it's the canonical source any NEW Literacy Manipulatives
// material (Phase 2/3 additions: punctuation tiles, spelling-rule cards,
// heart words, writing scaffolds...) should import its own tokens from,
// so the reconciliation problem (two competing sources) doesn't happen a
// third time.
export { MONTESSORI_WORD_CLASS_INFO, type MontessoriWordClass, type WordClassInfo } from './montessoriGrammar';
export { GRAMMAR_WORD_CLASS_COLORS, GRAMMAR_WORD_CLASS_TEXT_COLORS, type GrammarWordClass } from '../types';

// New shared tokens for Phase 2/3 material added to Literacy
// Manipulatives from here on, so every new category picks from one
// small, consistent set instead of each inventing its own ad hoc color.
export const LM_NEUTRAL_CARD_BG = '#ffffff';
export const LM_NEUTRAL_CARD_BORDER = 'var(--ink)';

// Punctuation tiles (Phase 2) — kept visually distinct (slate) from every
// existing word-class color family so a mark never gets mistaken for a
// word class.
export const LM_PUNCTUATION_COLOR = '#475569';
export const LM_PUNCTUATION_TEXT_COLOR = '#ffffff';

// Spelling rule cards (Phase 3).
export const LM_SPELLING_RULE_COLOR = '#fef3c7';

// Heart words (Phase 3) — the "irregular part" marker color, a warm red
// distinct from any word-class color, matching the literal heart-word
// convention (draw a heart over the part that doesn't sound the way it's
// spelled).
export const LM_HEART_COLOR = '#e11d48';

// Word Chains (Phase 3).
export const LM_WORD_CHAIN_COLOR = '#a7f3d0';

// Writing Scaffolds (Phase 3).
export const LM_WRITING_SCAFFOLD_COLOR = '#e0e7ff';

// Phonological Awareness (Phase 3).
export const LM_PHONO_COLOR = '#fce7f3';

// Dictation (Phase 3).
export const LM_DICTATION_COLOR = '#dbeafe';
