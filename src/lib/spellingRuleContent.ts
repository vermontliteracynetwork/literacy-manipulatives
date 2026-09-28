// Spelling Rule Cards — A23-ROADMAP Phase 3. Ordinary, well-established
// English spelling rules (not a specialized/copyrighted curriculum
// standard), each with one plain-language statement and one real
// example, shown via the shared ReferencePopover hover tooltip (same
// pattern Grammar Symbols/Punctuation tiles use).
export interface SpellingRule {
  id: string;
  title: string;
  rule: string;
  example: string;
}

export const SPELLING_RULES: SpellingRule[] = [
  { id: 'silent-e', title: 'Silent E', rule: 'A silent e at the end of a word often makes the vowel before it say its own name.', example: 'cap becomes cape' },
  { id: 'doubling', title: 'Doubling Rule', rule: 'In a short word with one vowel and one final consonant, double that consonant before adding an ending that starts with a vowel.', example: 'run becomes running' },
  { id: 'c-rule', title: 'Soft/Hard C', rule: 'C usually says /s/ before e, i, or y, and /k/ everywhere else.', example: 'city vs. cat' },
  { id: 'g-rule', title: 'Soft/Hard G', rule: 'G often says /j/ before e, i, or y, and /g/ everywhere else.', example: 'gem vs. gap' },
  { id: 'floss-rule', title: 'FLOSS Rule', rule: 'Right after a short vowel in a short word, f, l, s (and sometimes z) usually double at the end.', example: 'stuff, bell, pass' },
  { id: 'y-to-i', title: 'Change Y to I', rule: 'When a word ends in y after a consonant, change the y to i before adding most endings.', example: 'baby becomes babies' },
  { id: 'q-rule', title: 'Q Needs U', rule: 'The letter q is always followed by u in English words.', example: 'queen' },
  { id: 'plural-es', title: 'Plural -es', rule: 'Add -es instead of just -s when a word ends in s, x, z, ch, or sh.', example: 'box becomes boxes' },
];
