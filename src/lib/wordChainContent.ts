// Word Chains — A23-ROADMAP Phase 3 ("word chains... reusing the
// Morphemes 'connects only if real, never punitive' pattern"). Each
// chain is a real word-ladder: every word is a real English word, and
// each step changes exactly one letter/sound from the word before it —
// the classic "change one letter" word-building practice. Presented as
// plain reference rows (same WordListRow component/pattern Word Lists
// already uses), each word independently draggable onto the board as a
// letter tile so a student builds the chain themselves letter by
// letter, same as any other Word List entry. No auto-check, no
// "correct" progression enforced — a student can drag any word from any
// chain in any order.
export interface WordChain {
  id: string;
  label: string;
  words: string[]; // in ladder order, each one real-letter-swap away from the last
}

export const WORD_CHAINS: WordChain[] = [
  { id: 'chain-cat', label: 'cat chain', words: ['cat', 'cot', 'cog', 'dog', 'dot', 'hot'] },
  { id: 'chain-hop', label: 'hop chain', words: ['hop', 'hip', 'hit', 'sit', 'sip', 'sap', 'sad'] },
  { id: 'chain-pin', label: 'pin chain', words: ['pin', 'pan', 'pat', 'pot', 'pop', 'top', 'tap'] },
  { id: 'chain-big', label: 'big chain', words: ['big', 'bag', 'bat', 'bit', 'bid', 'lid', 'lip'] },
  { id: 'chain-mud', label: 'mud chain', words: ['mud', 'bud', 'bun', 'bin', 'bit', 'bat', 'ban'] },
];
