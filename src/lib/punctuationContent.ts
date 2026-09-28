// Punctuation tiles — A23-ROADMAP Phase 2: "punctuation tiles as a new
// opt-in, teacher-toggleable category (not a replacement for the current
// auto-punctuated Sentence Formulas, which are a helpful scaffold for
// this population)." Ordinary, uncontroversial English punctuation
// marks with a plain-language reference definition each (shown via the
// shared ReferencePopover hover tooltip, same pattern Grammar Symbols
// use) — not a specialized curriculum standard.
export interface PunctuationMark {
  id: string;
  mark: string;
  name: string;
  label: string; // plain-language definition, shown on hover like a Grammar Symbol
}

export const PUNCTUATION_MARKS: PunctuationMark[] = [
  { id: 'period', mark: '.', name: 'Period', label: 'Ends a telling sentence.' },
  { id: 'question', mark: '?', name: 'Question Mark', label: 'Ends an asking sentence.' },
  { id: 'exclamation', mark: '!', name: 'Exclamation Point', label: 'Ends an excited or loud sentence.' },
  { id: 'comma', mark: ',', name: 'Comma', label: 'A short pause, or separates items in a list.' },
  { id: 'apostrophe', mark: "'", name: 'Apostrophe', label: "Shows ownership (Mia's) or joins two words into one (don't)." },
  { id: 'quote-open', mark: '"', name: 'Quotation Marks', label: 'Goes around the exact words someone said.' },
  { id: 'colon', mark: ':', name: 'Colon', label: 'Introduces a list or an explanation.' },
  { id: 'semicolon', mark: ';', name: 'Semicolon', label: 'Joins two related complete sentences.' },
  { id: 'hyphen', mark: '-', name: 'Hyphen', label: 'Joins two words together (well-known).' },
  { id: 'ellipsis', mark: '...', name: 'Ellipsis', label: 'Shows words are trailing off or left out.' },
];
