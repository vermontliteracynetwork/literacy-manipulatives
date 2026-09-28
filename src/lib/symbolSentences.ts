// Symbol Sentences — direct teacher upload (Grammar_Cards.pdf, a real
// Montessori-style grammar-box deck: full sentences encoded purely as a
// left-to-right row of colored symbols, no words shown). "these cards
// should be available like the image attached in drag and drop, add
// another category called symbol sentences. these can be dragged and
// dropped same as individual symbols."
//
// Each entry here is one card from that deck, grouped into her own 11
// "pages" (3 sentences each, growing in complexity within a page). The
// real sentence text comes directly from the deck's own answer key page
// (unambiguous, teacher-authored); the per-word class tags are ordinary
// English grammar (not a specialized/copyrighted scheme), assigned by
// hand against that same answer key. Dragging a card onto the board
// drops its whole row of plain Montessori symbols at once — after that
// they're just ordinary placed shapes, freely separable and
// rearrangeable like any other Grammar Symbol.

import type { MontessoriWordClass } from './montessoriGrammar';

export interface SymbolSentenceWord {
  word: string;
  wordClass: MontessoriWordClass;
}

export interface SymbolSentence {
  id: string;
  sentence: string; // real English sentence, used only for the card's aria-label
  words: SymbolSentenceWord[];
}

export interface SymbolSentencePage {
  id: string;
  label: string;
  icon: string;
  sentences: SymbolSentence[];
}

function s(id: string, sentence: string, pairs: [string, MontessoriWordClass][]): SymbolSentence {
  return { id, sentence, words: pairs.map(([word, wordClass]) => ({ word, wordClass })) };
}

export const SYMBOL_SENTENCE_PAGES: SymbolSentencePage[] = [
  {
    id: 'page1', label: 'Descriptive', icon: '🎨', sentences: [
      s('p1-1', 'The cat ran.', [['The', 'article'], ['cat', 'noun'], ['ran', 'verb']]),
      s('p1-2', 'The small cat ran.', [['The', 'article'], ['small', 'adjective'], ['cat', 'noun'], ['ran', 'verb']]),
      s('p1-3', 'The small white cat ran.', [['The', 'article'], ['small', 'adjective'], ['white', 'adjective'], ['cat', 'noun'], ['ran', 'verb']]),
    ],
  },
  {
    id: 'page2', label: 'Adverbial', icon: '⚡', sentences: [
      s('p2-1', 'The cat ran quickly.', [['The', 'article'], ['cat', 'noun'], ['ran', 'verb'], ['quickly', 'adverb']]),
      s('p2-2', 'The small cat ran quickly.', [['The', 'article'], ['small', 'adjective'], ['cat', 'noun'], ['ran', 'verb'], ['quickly', 'adverb']]),
      s('p2-3', 'The small white cat ran quickly.', [['The', 'article'], ['small', 'adjective'], ['white', 'adjective'], ['cat', 'noun'], ['ran', 'verb'], ['quickly', 'adverb']]),
    ],
  },
  {
    id: 'page3', label: 'Joining Words', icon: '🔗', sentences: [
      s('p3-1', 'The cat and the dog ran.', [['The', 'article'], ['cat', 'noun'], ['and', 'conjunction'], ['the', 'article'], ['dog', 'noun'], ['ran', 'verb']]),
      s('p3-2', 'The small cat and the big dog ran.', [['The', 'article'], ['small', 'adjective'], ['cat', 'noun'], ['and', 'conjunction'], ['the', 'article'], ['big', 'adjective'], ['dog', 'noun'], ['ran', 'verb']]),
      s('p3-3', 'The small cat and the big dog ran quickly.', [['The', 'article'], ['small', 'adjective'], ['cat', 'noun'], ['and', 'conjunction'], ['the', 'article'], ['big', 'adjective'], ['dog', 'noun'], ['ran', 'verb'], ['quickly', 'adverb']]),
    ],
  },
  {
    id: 'page4', label: 'Where It Happened', icon: '🧭', sentences: [
      s('p4-1', 'The dog jumped over the cat.', [['The', 'article'], ['dog', 'noun'], ['jumped', 'verb'], ['over', 'preposition'], ['the', 'article'], ['cat', 'noun']]),
      s('p4-2', 'The big dog jumped over the cat.', [['The', 'article'], ['big', 'adjective'], ['dog', 'noun'], ['jumped', 'verb'], ['over', 'preposition'], ['the', 'article'], ['cat', 'noun']]),
      s('p4-3', 'The big dog jumped over and around the cat.', [['The', 'article'], ['big', 'adjective'], ['dog', 'noun'], ['jumped', 'verb'], ['over', 'preposition'], ['and', 'conjunction'], ['around', 'preposition'], ['the', 'article'], ['cat', 'noun']]),
    ],
  },
  {
    id: 'page5', label: 'Starting With How', icon: '🌀', sentences: [
      s('p5-1', 'Softly, the girl sings.', [['Softly', 'adverb'], ['the', 'article'], ['girl', 'noun'], ['sings', 'verb']]),
      s('p5-2', 'Softly, the young girl sings.', [['Softly', 'adverb'], ['the', 'article'], ['young', 'adjective'], ['girl', 'noun'], ['sings', 'verb']]),
      s('p5-3', 'Softly, the pretty young girl sings.', [['Softly', 'adverb'], ['the', 'article'], ['pretty', 'adjective'], ['young', 'adjective'], ['girl', 'noun'], ['sings', 'verb']]),
    ],
  },
  {
    id: 'page6', label: 'Two Actions Joined', icon: '🔁', sentences: [
      s('p6-1', 'The bug crawled slowly and the bird flew quickly.', [['The', 'article'], ['bug', 'noun'], ['crawled', 'verb'], ['slowly', 'adverb'], ['and', 'conjunction'], ['the', 'article'], ['bird', 'noun'], ['flew', 'verb'], ['quickly', 'adverb']]),
      s('p6-2', 'The fish and the dolphin swam and jumped.', [['The', 'article'], ['fish', 'noun'], ['and', 'conjunction'], ['the', 'article'], ['dolphin', 'noun'], ['swam', 'verb'], ['and', 'conjunction'], ['jumped', 'verb']]),
      s('p6-3', 'Quickly, the boy and the girl ran.', [['Quickly', 'adverb'], ['the', 'article'], ['boy', 'noun'], ['and', 'conjunction'], ['the', 'article'], ['girl', 'noun'], ['ran', 'verb']]),
    ],
  },
  {
    id: 'page7', label: 'Complex Sentences', icon: '🧩', sentences: [
      s('p7-1', 'Slowly, the turtle crawled, and quickly the hare ran.', [['Slowly', 'adverb'], ['the', 'article'], ['turtle', 'noun'], ['crawled', 'verb'], ['and', 'conjunction'], ['quickly', 'adverb'], ['the', 'article'], ['hare', 'noun'], ['ran', 'verb']]),
      s('p7-2', 'A small ball bounced loudly on the floor.', [['A', 'article'], ['small', 'adjective'], ['ball', 'noun'], ['bounced', 'verb'], ['loudly', 'adverb'], ['on', 'preposition'], ['the', 'article'], ['floor', 'noun']]),
      s('p7-3', 'Loudly, a hard rock broke through the window.', [['Loudly', 'adverb'], ['a', 'article'], ['hard', 'adjective'], ['rock', 'noun'], ['broke', 'verb'], ['through', 'preposition'], ['the', 'article'], ['window', 'noun']]),
    ],
  },
  {
    id: 'page8', label: 'Using Pronouns', icon: '👤', sentences: [
      s('p8-1', 'He jumps.', [['He', 'pronoun'], ['jumps', 'verb']]),
      s('p8-2', 'He jumps slowly.', [['He', 'pronoun'], ['jumps', 'verb'], ['slowly', 'adverb']]),
      s('p8-3', 'He jumps slowly and quietly.', [['He', 'pronoun'], ['jumps', 'verb'], ['slowly', 'adverb'], ['and', 'conjunction'], ['quietly', 'adverb']]),
    ],
  },
  {
    id: 'page9', label: 'Pronouns + Where', icon: '📍', sentences: [
      s('p9-1', 'He runs through the door.', [['He', 'pronoun'], ['runs', 'verb'], ['through', 'preposition'], ['the', 'article'], ['door', 'noun']]),
      s('p9-2', 'He runs quickly through the door.', [['He', 'pronoun'], ['runs', 'verb'], ['quickly', 'adverb'], ['through', 'preposition'], ['the', 'article'], ['door', 'noun']]),
      s('p9-3', 'He sings loudly and proudly.', [['He', 'pronoun'], ['sings', 'verb'], ['loudly', 'adverb'], ['and', 'conjunction'], ['proudly', 'adverb']]),
    ],
  },
  {
    id: 'page10', label: 'Doing Two Things', icon: '🙌', sentences: [
      s('p10-1', 'She cleans and dusts.', [['She', 'pronoun'], ['cleans', 'verb'], ['and', 'conjunction'], ['dusts', 'verb']]),
      s('p10-2', 'She eats and drinks at the table.', [['She', 'pronoun'], ['eats', 'verb'], ['and', 'conjunction'], ['drinks', 'verb'], ['at', 'preposition'], ['the', 'article'], ['table', 'noun']]),
      s('p10-3', 'He cooks and bakes in the kitchen.', [['He', 'pronoun'], ['cooks', 'verb'], ['and', 'conjunction'], ['bakes', 'verb'], ['in', 'preposition'], ['the', 'article'], ['kitchen', 'noun']]),
    ],
  },
  {
    id: 'page11', label: 'Interjections', icon: '❗', sentences: [
      s('p11-1', 'Eek! I missed the bus.', [['Eek', 'interjection'], ['I', 'pronoun'], ['missed', 'verb'], ['the', 'article'], ['bus', 'noun']]),
      s('p11-2', 'Phew! The plane landed safely.', [['Phew', 'interjection'], ['The', 'article'], ['plane', 'noun'], ['landed', 'verb'], ['safely', 'adverb']]),
      s('p11-3', 'Yuck! The popsicle melted.', [['Yuck', 'interjection'], ['The', 'article'], ['popsicle', 'noun'], ['melted', 'verb']]),
    ],
  },
];

// Flat lookup by id — used when a card dropped on the board needs to
// look its own real sentence/words back up (e.g. rendering a placed
// symbol-sentence unit, or its settings popup's word-fill inputs).
export const ALL_SYMBOL_SENTENCES: SymbolSentence[] = SYMBOL_SENTENCE_PAGES.flatMap((page) => page.sentences);
