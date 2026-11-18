import type { SymbolWordClass } from '../grammarSymbols';
import type { BoardData } from '../../LiteracyManipulatives';
import type { Procedure } from '../procedures/types';

// Daily Lesson (her request 2026-11-18, rebuilding the Daily Procedure): a lesson is a row of tabs on the left
// (Goal, Review, Instruction, Practice, Assessment, and Application from her Daily Lesson Structure). Each tab is
// like its own slide deck: it holds subheaders (sections, like "Symbol review" and "Formula review"), and each
// section holds activities. The right side shows a tab's activities as square cards; a card opens the activity.
// Edit mode edits every detail students see; Present mode shows it full screen to students who joined with the
// lesson's own join code, while the teacher keeps the notes, the student list and their live work.

export type TabKind = 'goal' | 'review' | 'instruction' | 'practice' | 'application' | 'assessment';
export const TAB_KINDS: { kind: TabKind; name: string; about: string }[] = [
  { kind: 'goal', name: 'Daily plan', about: "A one slide review of today's plan (what the lesson plan menu shows), with today's goal." },
  { kind: 'review', name: 'Review', about: "Symbols and formulas from earlier lessons: name it, show the motion, give a word." },
  { kind: 'instruction', name: 'Instruction', about: "Explicit instruction on today's formula set: Procedure A, then a Sentence Pyramid." },
  { kind: 'practice', name: 'Practice', about: 'Teacher and students practice the new formula together, with high support.' },
  { kind: 'application', name: 'Application', about: "Independent or lower-support reinforcement with today's formula." },
  { kind: 'assessment', name: 'Assessment', about: 'A quick check: 3 to 5 items, no modeling, scored the same way every time.' },
];
export const tabKindName = (k: TabKind) => TAB_KINDS.find((t) => t.kind === k)?.name ?? k;

// Each activity runs on one engine; the catalog below is her Practice Activities Bank and procedures, each set up on
// the engine that fits it.
export type Engine =
  | 'goal' | 'slide' | 'symbolMatch' | 'sort' | 'define' | 'wordList' | 'memory' | 'pull' | 'build' | 'write'
  | 'fill' | 'pyramid' | 'edit' | 'time' | 'choice' | 'markup' | 'tictactoe' | 'fishing' | 'search' | 'procA'
  | 'assess' | 'board' | 'legacy';

export type Access = 'view' | 'do';
export type ActivityData = Record<string, unknown>;

export interface Activity {
  id: string;
  preset: string;      // catalog id ("word-sort")
  engine: Engine;
  title: string;       // card name
  about: string;       // card's short description
  directions: string;  // what students read (and hear) at the top
  access: Access;      // view only, or students do it on their iPads
  minutes?: string;
  timer?: number;      // seconds; a timer on the activity when set (Edit: Timer on or off)
  scope?: 'lesson' | 'cumulative'; // Practice Activities Bank rule: Lesson-specific or Cumulative review
  notes: string;       // teacher only
  data: ActivityData;
  board?: BoardData;   // whiteboard activities
}
export interface Section { id: string; title: string; activities: Activity[] }
export interface Tab { id: string; kind: TabKind; title: string; minutes?: string; notes: string; sections: Section[] }

export interface Lesson {
  v: 2;
  id: string;
  title: string;
  subtitle?: string;
  folderId: string | null;
  updatedAt: string;
  saved?: boolean;
  code?: string;                     // the lesson's own join code (kept with the lesson)
  focus: { symbols: SymbolWordClass[]; formulas: string[] }; // today's symbols and formula codes (defaults for new activities)
  progress: 'bar' | 'checklist';     // what students see across the top in Present mode
  tabs: Tab[];
}

// Each tab's color, the same in the lesson plan menu, the dropdowns and the daily plan slide.
export const TAB_COLOR: Record<TabKind, string> = { goal: '#FBF2BB', review: '#E5B9E0', instruction: '#C5E4ED', practice: '#C9EBD3', application: '#F9D4C0', assessment: '#cbd5e1' };

export const newId = () => Math.random().toString(36).slice(2, 10);
export const newCode = () => String(1000 + Math.floor(Math.random() * 9000));

// ---------- The activity catalog ----------
export type FieldKind = 'text' | 'textarea' | 'lines' | 'symbols' | 'formulas' | 'formula' | 'number' | 'bool' | 'picture' | 'select';
export interface Field { key: string; label: string; kind: FieldKind; help?: string; options?: { value: string; label: string }[] }

export interface Preset {
  id: string;
  engine: Engine;
  name: string;
  about: string;
  directions: string;
  group: string;           // where it shows in the catalog
  tabs: TabKind[];         // tabs it suits best (all tabs can use any activity)
  levels?: string;         // Practice Activities Bank levels
  access: Access;
  data: (focus: Lesson['focus']) => ActivityData;
}

const FIRST = (f: Lesson['focus']): string => f.formulas[0] ?? 'S1.A';
const SYMS = (f: Lesson['focus']): SymbolWordClass[] => (f.symbols.length ? f.symbols : ['article', 'noun', 'verb']);

export const PRESETS: Preset[] = [
  // Goal
  { id: 'goal', engine: 'goal', name: "Today's plan", about: "Today's plan on one slide: each part of the lesson and its activities.", directions: '', group: 'Daily plan', tabs: ['goal'], access: 'view',
    data: () => ({ goal: '', closing: '', agenda: true }) },
  { id: 'slide', engine: 'slide', name: 'Slide', about: 'Your own slide: a heading, words and a picture.', directions: '', group: 'Slides', tabs: ['goal', 'review', 'instruction', 'practice', 'application', 'assessment'], access: 'view',
    data: () => ({ heading: '', text: '', bullets: [], picture: '' }) },
  // Symbol review
  { id: 'name-motion', engine: 'legacy', name: 'Name it, show the motion, give a word', about: 'Procedure G: each symbol named, its motion done, 3 to 5 words.', directions: '', group: 'Symbol review', tabs: ['review'], access: 'view',
    data: (f) => ({ kind: 'review-symbols', page: { directions: ['Name it. Show the motion. Give me a word.'], symbols: SYMS(f).map((cls) => ({ cls, motion: '', words: [] })), timerSeconds: 30 } }) },
  { id: 'symbol-dnd', engine: 'symbolMatch', name: 'Symbol drag and drop', about: 'Drag each symbol to its name.', directions: 'Drag each symbol to its name.', group: 'Symbol review', tabs: ['review'], access: 'do',
    data: (f) => ({ symbols: SYMS(f) }) },
  { id: 'word-sort', engine: 'sort', name: 'Word sort', about: 'Sort words under their symbols.', directions: 'Sort each word under its symbol.', group: 'Symbol review', tabs: ['review', 'practice'], access: 'do',
    data: (f) => ({ mode: 'symbols', symbols: SYMS(f), items: ['the', 'dog', 'runs', 'a', 'cat', 'jumps'] }) },
  { id: 'define-pos', engine: 'define', name: 'Define each part of speech', about: 'Say or write what each symbol means.', directions: 'Tell what each symbol means.', group: 'Symbol review', tabs: ['review'], access: 'do',
    data: (f) => ({ symbols: SYMS(f), models: [] }) },
  { id: 'word-list', engine: 'wordList', name: 'Word list for each part of speech', about: 'Make a list of 3 to 5 words for each symbol.', directions: 'Write words for each symbol.', group: 'Symbol review', tabs: ['review'], access: 'do',
    data: (f) => ({ symbols: SYMS(f), count: 3 }) },
  { id: 'pos-memory', engine: 'memory', name: 'Parts of Speech Memory', about: 'Flip cards to match each symbol with a word.', directions: 'Find each symbol and its word.', group: 'Symbol review', tabs: ['review', 'practice', 'application'], levels: 'A B C', access: 'do',
    data: () => ({ pairs: ['noun = cat', 'verb = jumps', 'article = the', 'adjective = big'] }) },
  { id: 'pos-jenga', engine: 'pull', name: 'Parts of Speech Jenga', about: 'Pull a block, then name a word for its symbol.', directions: 'Pull a block. Name a word for it.', group: 'Symbol review', tabs: ['review', 'application'], levels: 'A B C', access: 'do',
    data: (f) => ({ deck: 'symbols', symbols: SYMS(f), formulas: f.formulas, pulls: 5 }) },
  // Formula review
  { id: 'formula-dnd', engine: 'build', name: 'Formula drag and drop', about: 'Drag word cards into the formula, in order.', directions: 'Put the word cards in order under the formula.', group: 'Formula review', tabs: ['review', 'practice'], access: 'do',
    data: () => ({ unit: 'words', items: ['The frog jumps.'], showStrip: true, model: '' }) },
  { id: 'own-sentence', engine: 'write', name: 'Create your own sentence', about: 'Write your own sentence for a formula.', directions: 'Write your own sentence for the formula.', group: 'Formula review', tabs: ['review', 'practice', 'application'], access: 'do',
    data: (f) => ({ prompt: '', picture: '', emoji: '', formulas: [FIRST(f)], lines: 1, model: '', dictate: [], check: 'formula' }) },
  { id: 'picture-sentence', engine: 'write', name: 'Picture sentence', about: 'Write a sentence about a picture with the formula.', directions: 'Look at the picture. Write a sentence about it.', group: 'Formula review', tabs: ['review', 'practice', 'instruction'], access: 'do',
    data: (f) => ({ prompt: '', picture: '', emoji: '', formulas: [FIRST(f)], lines: 1, model: '', dictate: [], check: 'formula' }) },
  { id: 'formula-jenga', engine: 'pull', name: 'Formula Jenga', about: 'Pull a formula block, then write a sentence for it.', directions: 'Pull a block. Write a sentence for its formula.', group: 'Formula review', tabs: ['review', 'practice', 'application'], levels: 'A B C', access: 'do',
    data: (f) => ({ deck: 'formulas', symbols: SYMS(f), formulas: f.formulas.length ? f.formulas : ['S1.A'], pulls: 3 }) },
  // Instruction
  { id: 'procedure-a', engine: 'procA', name: 'Procedure A: New formula', about: 'Name and show the formula, I do, We do, You do, Sentence Check.', directions: '', group: 'Instruction', tabs: ['instruction'], access: 'view',
    data: (f) => ({ formula: FIRST(f), model: '', nonExample: '', iDo: ["What's my formula? Say it first.", 'One symbol, one word.', 'Read it back. Check it.'], weDo: [], youDo: ['Write a sentence for this formula.'], checklist: ['Complete', 'Capital letter', 'Punctuation', 'Match', 'Time'] }) },
  { id: 'sentence-pyramid', engine: 'pyramid', name: 'Sentence Pyramid', about: 'Grow one sentence a line at a time.', directions: 'Grow the sentence one line at a time.', group: 'Instruction', tabs: ['instruction', 'practice'], levels: 'A B C', access: 'view',
    data: () => ({ lines: ['Dogs run.', 'The dogs run.', 'The big dogs run.', 'The big dogs run fast.'], reveal: true, studentWrites: false }) },
  { id: 'symbol-story', engine: 'slide', name: 'Procedure B: Symbol Story', about: 'Tell the story of a symbol with its motion.', directions: '', group: 'Instruction', tabs: ['instruction'], access: 'view',
    data: () => ({ heading: 'Symbol Story', text: '', bullets: [], picture: '' }) },
  { id: 'picture-builder', engine: 'write', name: 'Procedure C: Picture Sentence Builder', about: 'Look, name the parts, build the sentence.', directions: 'Who is it? What do they do? Build the sentence.', group: 'Instruction', tabs: ['instruction', 'practice'], access: 'do',
    data: (f) => ({ prompt: 'Who is it? What do they do?', picture: '', emoji: '', formulas: [FIRST(f)], lines: 1, model: '', dictate: [], check: 'formula' }) },
  { id: 'tense-builder', engine: 'time', name: 'Procedure D: Tense Builder', about: 'One sentence in the past, present and future.', directions: 'Write the sentence in the past, present and future.', group: 'Instruction', tabs: ['instruction', 'practice'], access: 'do',
    data: () => ({ sentences: ['The dog runs.'] }) },
  { id: 'restate', engine: 'write', name: 'Procedure E: Restating the Question', about: 'Restate the question and answer in a complete sentence.', directions: 'Use the words of the question in your answer.', group: 'Instruction', tabs: ['instruction', 'practice'], levels: 'B C', access: 'do',
    data: () => ({ prompt: 'What does the frog do?', picture: '', emoji: '', formulas: [], lines: 1, model: 'The frog jumps.', dictate: [], check: 'sentence' }) },
  // Practice: sentence-level (Practice Activities Bank)
  { id: 'rebus', engine: 'write', name: 'Rebus Sentences', about: 'A picture stands in for a word.', directions: 'Read it. Write the sentence with words.', group: 'Practice: sentences', tabs: ['practice', 'application'], levels: 'A B C', access: 'do',
    data: (f) => ({ prompt: 'The 🐸 jumps.', picture: '', emoji: '', formulas: [FIRST(f)], lines: 1, model: 'The frog jumps.', dictate: [], check: 'formula' }) },
  { id: 'picture-writing', engine: 'write', name: 'Picture Writing', about: 'Write a sentence about a picture with the formulas.', directions: 'Write a sentence about the picture.', group: 'Practice: sentences', tabs: ['practice', 'application'], levels: 'A B C', access: 'do',
    data: (f) => ({ prompt: '', picture: '', emoji: '', formulas: f.formulas.length ? f.formulas : ['S1.A'], lines: 1, model: '', dictate: [], check: 'formula' }) },
  { id: 'fill-in-story', engine: 'fill', name: 'Fill-In Stories', about: 'Pick words for the symbol blanks, then read the silly story.', directions: 'Pick a word for each blank. Then read your silly story.', group: 'Practice: sentences', tabs: ['practice', 'application'], levels: 'A B C', access: 'do',
    data: () => ({ story: 'The [adjective] [noun] [verb] over the [noun].' }) },
  { id: 'pyramid-practice', engine: 'pyramid', name: 'Sentence Pyramid (students build)', about: 'Students grow their own sentence a line at a time.', directions: 'Add one more part on each line.', group: 'Practice: sentences', tabs: ['practice'], levels: 'A B C', access: 'do',
    data: () => ({ lines: ['Dogs run.'], reveal: false, studentWrites: true }) },
  { id: 'fill-pyramid', engine: 'pyramid', name: 'Fill-in-the-Blank Sentence Pyramids', about: 'Add one more word on each layer of the pyramid.', directions: 'Fill in one word on each layer.', group: 'Practice: sentences', tabs: ['practice'], levels: 'B C', access: 'do',
    data: () => ({ lines: ['[noun] run.', 'The [noun] run.', 'The [adjective] dogs run.', 'The big dogs run [adverb].'], reveal: false, studentWrites: false }) },
  { id: 'sentence-edits', engine: 'edit', name: 'Sentence Edits', about: 'Find and fix the mistakes.', directions: 'Find the mistake. Fix the sentence.', group: 'Practice: sentences', tabs: ['practice', 'application'], levels: 'A B C', access: 'do',
    data: () => ({ items: ['the dog run => The dog runs.'] }) },
  { id: 'dictated', engine: 'write', name: 'Dictated Sentences', about: 'Listen, write it, read it back, check it.', directions: 'Listen. Write the sentence. Read it back.', group: 'Practice: sentences', tabs: ['practice', 'assessment'], levels: 'A B C', access: 'do',
    data: () => ({ prompt: '', picture: '', emoji: '', formulas: [], lines: 3, model: '', dictate: ['The cat naps.', 'A dog runs.', 'The frogs jump.'], check: 'sentence' }) },
  { id: 'unscramble', engine: 'build', name: 'Sentence Unscramble', about: 'Put word cards in order under the formula strip.', directions: 'Put the words in order.', group: 'Practice: sentences', tabs: ['practice', 'review'], levels: 'A B C', access: 'do',
    data: () => ({ unit: 'words', items: ['The cat naps.', 'A dog runs.'], showStrip: true, model: '' }) },
  { id: 'unscramble-imitate', engine: 'build', name: 'Unscramble to Imitate', about: 'Unscramble a new sentence that matches the model.', directions: 'Make a sentence like the model.', group: 'Practice: sentences', tabs: ['practice'], levels: 'A B C', access: 'do',
    data: () => ({ unit: 'words', items: ['The bird sings.'], showStrip: true, model: 'The frog jumps.' }) },
  { id: 'time-machine', engine: 'time', name: 'Time Machine', about: 'Rewrite the sentence for the past, present and future.', directions: 'Write it in the past, present and future.', group: 'Practice: sentences', tabs: ['practice', 'application'], levels: 'A B C', access: 'do',
    data: () => ({ sentences: ['The frog jumps.'] }) },
  { id: 'sequential', engine: 'pyramid', name: 'Sequential Sentences', about: 'Start simple, then add what, where, when or why.', directions: 'Add what, where, when or why.', group: 'Practice: sentences', tabs: ['practice'], levels: 'A B C', access: 'do',
    data: () => ({ lines: ['The dog runs.'], reveal: false, studentWrites: true }) },
  { id: 'formula-sort', engine: 'sort', name: 'Formula Sort', about: 'Sort sentence strips under the formulas they match.', directions: 'Put each sentence under its formula.', group: 'Practice: sentences', tabs: ['practice', 'review'], levels: 'A B C', access: 'do',
    data: (f) => ({ mode: 'formulas', formulas: f.formulas.length ? f.formulas : ['S1.A', 'S1.B'], items: ['The frog jumps.', 'Max runs.'] }) },
  { id: 'notes-to-sentences', engine: 'write', name: 'Notes to Sentences', about: 'Turn key words or picture notes into sentences.', directions: 'Turn the notes into a sentence.', group: 'Practice: sentences', tabs: ['practice', 'application'], levels: 'A B C', access: 'do',
    data: () => ({ prompt: 'dog / park / run', picture: '', emoji: '', formulas: [], lines: 1, model: '', dictate: [], check: 'sentence' }) },
  { id: 'sentence-search', engine: 'search', name: 'Sentence Search', about: 'Find the words, then write a sentence with them.', directions: 'Find each word. Then write a sentence with them.', group: 'Practice: sentences', tabs: ['practice', 'application'], levels: 'A B C', access: 'do',
    data: () => ({ words: ['frog', 'jumps', 'the', 'pond'], prompt: 'Write a sentence with the words you found.' }) },
  { id: 'formula-fishing', engine: 'fishing', name: 'Formula Fishing', about: 'Flip a formula card and play word cards in its order.', directions: 'Play word cards in the order of the formula. Read your silly sentence.', group: 'Practice: games', tabs: ['practice', 'application'], levels: 'A B C', access: 'do',
    data: (f) => ({ formulas: f.formulas.length ? f.formulas : ['S1.A'], goal: 3 }) },
  { id: 'tic-tac-toe', engine: 'tictactoe', name: 'Sentence Tic-Tac-Toe', about: 'Claim a square with a correct sentence for its formula.', directions: 'Pick a square. Write a sentence for its formula.', group: 'Practice: games', tabs: ['practice', 'application'], levels: 'A B C', access: 'do',
    data: (f) => ({ formulas: f.formulas.length ? f.formulas : ['S1.A'] }) },
  { id: 'emoji-translate', engine: 'write', name: 'Emoji Translate', about: 'Turn a string of emojis into a sentence.', directions: 'Write the emojis as a sentence.', group: 'Practice: sentences', tabs: ['practice', 'application'], levels: 'A B C', access: 'do',
    data: () => ({ prompt: '', picture: '', emoji: '🐸 ➡️ 🪷', formulas: [], lines: 1, model: '', dictate: [], check: 'sentence' }) },
  { id: 'tongue-twisters', engine: 'write', name: 'Tongue Twisters', about: 'Alliterative sentences that follow a formula.', directions: 'Write a sentence where the words start with the same sound.', group: 'Practice: sentences', tabs: ['practice', 'application'], levels: 'A B C', access: 'do',
    data: (f) => ({ prompt: 'The tiny tiger tiptoed.', picture: '', emoji: '', formulas: [FIRST(f)], lines: 1, model: '', dictate: [], check: 'formula' }) },
  { id: 'riddle-me', engine: 'write', name: 'Riddle Me', about: 'Write "I am..." clues for a mystery animal or object.', directions: 'Write clues that start with "I am".', group: 'Practice: sentences', tabs: ['practice', 'application'], levels: 'A B C', access: 'do',
    data: () => ({ prompt: 'Pick a mystery animal. Write three clues.', picture: '', emoji: '', formulas: [], lines: 3, model: 'I am green.', dictate: [], check: 'sentence' }) },
  { id: 'two-truths', engine: 'write', name: 'Two Truths and a Lie', about: 'Write three statements, one of them false.', directions: 'Write three statements. Make one of them false.', group: 'Practice: sentences', tabs: ['practice', 'application'], levels: 'A B C', access: 'do',
    data: () => ({ prompt: '', picture: '', emoji: '', formulas: [], lines: 3, model: '', dictate: [], check: 'sentence' }) },
  { id: 'mark-ups', engine: 'markup', name: 'Sentence Mark-Ups', about: 'Mark each word with its symbol.', directions: 'Tap each word. Choose its symbol.', group: 'Practice: sentences', tabs: ['practice', 'review'], levels: 'B C', access: 'do',
    data: () => ({ sentences: ['The big dog runs.'] }) },
  { id: 'fragment-sort', engine: 'sort', name: 'Sentence vs. Fragment Sort', about: 'Sort sentences from fragments, then fix the fragments.', directions: 'Is it a sentence or a fragment?', group: 'Practice: sentences', tabs: ['practice'], levels: 'B C', access: 'do',
    data: () => ({ mode: 'labels', labels: ['Sentence', 'Fragment'], items: ['The dog runs. = Sentence', 'the big dog = Fragment'] }) },
  { id: 'combinations', engine: 'write', name: 'Sentence Combinations', about: 'Join 2 to 3 short sentences into one.', directions: 'Join the sentences into one sentence.', group: 'Practice: sentences', tabs: ['practice'], levels: 'B C', access: 'do',
    data: () => ({ prompt: 'The dog runs. The cat runs.', picture: '', emoji: '', formulas: [], lines: 1, model: 'The dog and the cat run.', dictate: [], check: 'sentence' }) },
  { id: 'mirror', engine: 'write', name: 'Mirror Sentences', about: "Notice a sentence's formula, then write your own like it.", directions: 'Write your own sentence like the model.', group: 'Practice: sentences', tabs: ['practice'], levels: 'B C', access: 'do',
    data: (f) => ({ prompt: '', picture: '', emoji: '', formulas: [FIRST(f)], lines: 1, model: 'The frog jumps.', dictate: [], check: 'formula' }) },
  { id: 'sentence-group', engine: 'write', name: 'Guided Sentence Group', about: 'Three sentences on one topic, each a different formula.', directions: 'Write three sentences about one topic.', group: 'Practice: sentences', tabs: ['practice', 'application'], levels: 'B C', access: 'do',
    data: (f) => ({ prompt: 'Topic: ', picture: '', emoji: '', formulas: f.formulas.slice(0, 3), lines: 3, model: '', dictate: [], check: 'sentence' }) },
  { id: 'question-to-sentence', engine: 'write', name: 'Question to Sentence', about: 'Restate the question and answer in a complete sentence.', directions: 'Answer in a complete sentence.', group: 'Practice: sentences', tabs: ['practice'], levels: 'B C', access: 'do',
    data: () => ({ prompt: 'Where does the frog live?', picture: '', emoji: '', formulas: [], lines: 1, model: 'The frog lives in the pond.', dictate: [], check: 'sentence' }) },
  { id: 'headline', engine: 'write', name: 'Headline to Sentence', about: 'Expand a headline into sentences.', directions: 'Turn the headline into sentences.', group: 'Practice: sentences', tabs: ['practice', 'application'], levels: 'B C', access: 'do',
    data: () => ({ prompt: 'Dog Wins Race', picture: '', emoji: '', formulas: [], lines: 3, model: '', dictate: [], check: 'sentence' }) },
  { id: 'detective', engine: 'write', name: 'Sentence Detective', about: 'Use clues to work out a hidden sentence.', directions: 'Use the clues. Write the hidden sentence.', group: 'Practice: sentences', tabs: ['practice'], levels: 'B C', access: 'do',
    data: (f) => ({ prompt: 'Clue 1: It is an animal.\nClue 2: It jumps.', picture: '', emoji: '', formulas: [FIRST(f)], lines: 1, model: 'The frog jumps.', dictate: [], check: 'formula' }) },
  { id: 'which-better', engine: 'choice', name: 'Which Works Better?', about: 'Pick the version that fits the purpose and say why.', directions: 'Which sentence works better? Why?', group: 'Practice: sentences', tabs: ['practice'], levels: 'B C', access: 'do',
    data: () => ({ items: ['Make the reader see it. | The dog ran. / The muddy dog ran fast. | The muddy dog ran fast.'], speak: true }) },
  { id: 'many-ways', engine: 'write', name: 'Many Ways to Say It', about: 'One idea, built in every taught formula.', directions: 'Say the same idea in different formulas.', group: 'Practice: sentences', tabs: ['practice'], levels: 'A B C', access: 'do',
    data: (f) => ({ prompt: 'Idea: a dog and a ball', picture: '', emoji: '', formulas: f.formulas.slice(0, 3), lines: 2, model: '', dictate: [], check: 'sentence' }) },
  { id: 'end-mark', engine: 'choice', name: 'Which End Mark?', about: 'Listen to how the voice ends, then choose the end mark.', directions: 'Listen. Choose the end mark.', group: 'Practice: sentences', tabs: ['practice', 'review'], levels: 'A B C', access: 'do',
    data: () => ({ items: ['The cat is asleep | . / ? / ! | .'], speak: true }) },
  // Practice: paragraphs
  { id: 'paragraph-puzzle', engine: 'build', name: 'Paragraph Puzzle', about: 'Put a cut-up paragraph back in order.', directions: 'Put the sentences in order.', group: 'Practice: paragraphs', tabs: ['practice', 'application'], levels: 'B C', access: 'do',
    data: () => ({ unit: 'sentences', items: ['First, the frog wakes up.', 'Next, it jumps in the pond.', 'Last, it naps on a rock.'], showStrip: false, model: '' }) },
  { id: 'odd-one-out', engine: 'choice', name: 'Odd One Out', about: "Find the sentence that doesn't belong.", directions: "Which sentence doesn't belong?", group: 'Practice: paragraphs', tabs: ['practice', 'application'], levels: 'B C', access: 'do',
    data: () => ({ items: ['Frogs | Frogs live in ponds. / Frogs can jump far. / My bike is red. | My bike is red.'], speak: false }) },
  { id: 'casual-formal', engine: 'write', name: 'Casual to Formal', about: 'Turn a casual text thread into a correct paragraph.', directions: 'Write it as a correct paragraph.', group: 'Practice: paragraphs', tabs: ['practice', 'application'], levels: 'B C', access: 'do',
    data: () => ({ prompt: 'omg the dog ran sooo fast lol', picture: '', emoji: '', formulas: [], lines: 3, model: '', dictate: [], check: 'sentence' }) },
  // Assessment
  { id: 'quick-check', engine: 'assess', name: 'Quick check', about: '3 to 5 items, no modeling, scored the same way every time.', directions: 'Write a sentence for each one.', group: 'Assessment', tabs: ['assessment'], access: 'do',
    data: (f) => ({ items: [`Write a sentence for the formula. | ${FIRST(f)}`, `Write another sentence for the formula. | ${FIRST(f)}`, `Write one more. | ${FIRST(f)}`], checks: ['Formula', 'Capital letter', 'Punctuation'] }) },
  // Anything else
  { id: 'whiteboard', engine: 'board', name: 'Whiteboard', about: 'A whiteboard page with every board material.', directions: '', group: 'Whiteboard', tabs: ['review', 'instruction', 'practice', 'application', 'assessment'], access: 'view',
    data: () => ({}) },
];
export const presetById = (id: string) => PRESETS.find((p) => p.id === id);

export function newActivity(presetId: string, focus: Lesson['focus']): Activity {
  const p = presetById(presetId) ?? PRESETS[1];
  return { id: newId(), preset: p.id, engine: p.engine, title: p.name, about: p.about, directions: p.directions, access: p.access, notes: '', data: p.data(focus), ...(p.engine === 'board' ? { board: { placed: [], strokes: [] } } : {}) };
}

// The fields each engine shows in Edit mode, so every student-facing detail can be changed.
const F = (key: string, label: string, kind: FieldKind, help?: string, options?: Field['options']): Field => ({ key, label, kind, help, options });
export const ENGINE_FIELDS: Record<Engine, Field[]> = {
  goal: [F('goal', "Today's goal in student words (optional)", 'textarea'), F('closing', 'By the end (optional)', 'text'), F('agenda', 'Show each activity under its part of the lesson', 'bool')],
  slide: [F('heading', 'Heading', 'text'), F('text', 'Words', 'textarea'), F('bullets', 'List (one per line)', 'lines'), F('picture', 'Picture', 'picture')],
  symbolMatch: [F('symbols', 'Symbols to review', 'symbols')],
  sort: [F('mode', 'Sort under', 'select', undefined, [{ value: 'symbols', label: 'Symbols' }, { value: 'formulas', label: 'Formulas' }, { value: 'labels', label: 'My own labels' }]),
    F('symbols', 'Symbols (for a symbol sort)', 'symbols'), F('formulas', 'Formulas (for a formula sort)', 'formulas'), F('labels', 'Labels (for your own sort, one per line)', 'lines'),
    F('items', 'Cards (one per line)', 'lines', 'The engine finds each card\'s symbol or formula. To set it yourself, add " = noun", " = S1.A" or " = your label".')],
  define: [F('symbols', 'Symbols', 'symbols'), F('models', 'Model answers (one per line: noun = a person, place, thing or animal)', 'lines', 'Left empty, the symbol cards\' own meanings are used.')],
  wordList: [F('symbols', 'Symbols', 'symbols'), F('count', 'Words for each symbol', 'number')],
  memory: [F('pairs', 'Pairs (one per line: noun = cat)', 'lines')],
  pull: [F('deck', 'Blocks show', 'select', undefined, [{ value: 'symbols', label: 'Symbols (name a word)' }, { value: 'formulas', label: 'Formulas (write a sentence)' }]), F('symbols', 'Symbol blocks', 'symbols'), F('formulas', 'Formula blocks', 'formulas'), F('pulls', 'Blocks to pull', 'number')],
  build: [F('unit', 'Cards are', 'select', undefined, [{ value: 'words', label: 'Words (unscramble a sentence)' }, { value: 'sentences', label: 'Sentences (order a paragraph)' }]),
    F('items', 'Sentences (one per line; a paragraph puzzle uses one sentence per line, in order)', 'lines'), F('showStrip', 'Show the formula strip', 'bool'), F('model', 'Model sentence to imitate (optional)', 'text')],
  write: [F('prompt', 'Prompt or question', 'textarea'), F('picture', 'Picture', 'picture'), F('emoji', 'Emojis', 'text'), F('formulas', 'Formulas to use', 'formulas'), F('lines', 'Sentences to write', 'number'),
    F('model', 'Model answer (shows after they try)', 'text'), F('dictate', 'Sentences to read aloud (dictation, one per line)', 'lines'),
    F('check', 'Check', 'select', undefined, [{ value: 'formula', label: 'Matches the formula, capital letter, punctuation' }, { value: 'sentence', label: 'Capital letter and punctuation' }, { value: 'none', label: 'No check' }]), F('tiles', 'Word tiles (one per line; left empty, the engine picks words for each symbol of the formula)', 'lines'), F('tilesFirst', 'Start with word tiles', 'bool'), F('noTiles', 'Turn word tiles off', 'bool')],
  fill: [F('story', 'Story (put a symbol name in brackets for each blank: [noun])', 'textarea')],
  pyramid: [F('lines', 'Pyramid lines (top to bottom; [noun] makes a blank)', 'lines'), F('reveal', 'Show one line at a time (Next line)', 'bool'), F('studentWrites', 'Students write their own next lines', 'bool')],
  edit: [F('items', 'Sentences to fix (one per line: wrong => right)', 'lines')],
  time: [F('sentences', 'Sentences (one per line)', 'lines')],
  choice: [F('items', 'Questions (one per line: question | choice / choice / choice | answer)', 'lines'), F('speak', 'Read each question aloud', 'bool')],
  markup: [F('sentences', 'Sentences to mark up (one per line)', 'lines')],
  tictactoe: [F('formulas', 'Formulas for the squares (repeats to fill 9)', 'formulas')],
  fishing: [F('formulas', 'Formula cards', 'formulas'), F('goal', 'Formulas to finish', 'number')],
  search: [F('words', 'Words to find (one per line)', 'lines'), F('prompt', 'Then write', 'text')],
  procA: [F('formula', "Today's formula", 'formula'), F('model', 'Model sentence (I do)', 'text'), F('nonExample', 'Non-example', 'text'),
    F('iDo', 'I do: think-aloud lines', 'lines'), F('weDo', 'We do: sentences to build together', 'lines'), F('youDo', 'You do: prompts', 'lines'), F('checklist', 'Sentence Check', 'lines'), F('tiles', 'Word tiles (one per line; left empty, the engine picks words for each symbol of the formula)', 'lines'), F('tilesFirst', 'Start with word tiles', 'bool'), F('noTiles', 'Turn word tiles off', 'bool')],
  assess: [F('items', 'Items (one per line: prompt | formula code, optional)', 'lines'), F('checks', 'Checks', 'lines'), F('tiles', 'Word tiles (one per line; left empty, the engine picks words for each symbol of the formula)', 'lines'), F('tilesFirst', 'Start with word tiles', 'bool'), F('noTiles', 'Turn word tiles off', 'bool')],
  board: [],
  legacy: [],
};

// ---------- New lessons ----------
function section(title: string, presetIds: string[], focus: Lesson['focus']): Section {
  return { id: newId(), title, activities: presetIds.map((p) => newActivity(p, focus)) };
}
export function newTab(kind: TabKind, focus: Lesson['focus']): Tab {
  const t = (title: string, sections: Section[]): Tab => ({ id: newId(), kind, title, notes: '', sections });
  switch (kind) {
    case 'goal': return t('Daily plan', [section("Today's plan", ['goal'], focus)]);
    case 'review': return t('Review', [
      section('Symbol review', ['name-motion', 'symbol-dnd', 'word-sort', 'define-pos', 'word-list'], focus),
      section('Formula review', ['formula-dnd', 'own-sentence', 'picture-sentence'], focus),
    ]);
    case 'instruction': return t('Instruction', [section('New formula', ['procedure-a', 'sentence-pyramid'], focus)]);
    case 'practice': return t('Practice', [section('Practice together', [], focus)]);
    case 'application': return t('Application', [section('On your own', [], focus)]);
    case 'assessment': return t('Assessment', [section('Quick check', ['quick-check'], focus)]);
  }
}
export function blankLesson(): Lesson {
  const focus: Lesson['focus'] = { symbols: ['article', 'noun', 'verb'], formulas: ['S1.A'] };
  return {
    v: 2, id: newId(), title: 'New lesson', folderId: null, updatedAt: new Date().toISOString(), focus, progress: 'bar',
    tabs: (['goal', 'review', 'instruction', 'practice', 'assessment'] as TabKind[]).map((k) => newTab(k, focus)),
  };
}

// A deep copy with new ids (Duplicate).
export function copyTab(t: Tab): Tab {
  return { ...structuredClone(t), id: newId(), title: `${t.title} (copy)`, sections: t.sections.map((s) => ({ ...structuredClone(s), id: newId(), activities: s.activities.map((a) => ({ ...structuredClone(a), id: newId() })) })) };
}

// Every activity in order, for Present mode.
export interface Stop { tab: Tab; section: Section; activity: Activity }
export const stopsOf = (l: Lesson): Stop[] => l.tabs.flatMap((tab) => tab.sections.flatMap((section) => section.activities.map((activity) => ({ tab, section, activity }))));

// What students receive: the lesson without the teacher's notes.
// On an Assessment tab the answer keys stay on the teacher's screen too (marks are worked out there).
function withoutKey(a: Activity): Activity {
  const d = { ...a.data };
  const items = Array.isArray(d.items) ? (d.items as string[]) : [];
  if (a.engine === 'choice') d.items = items.map((l) => l.split('|').slice(0, 2).join('|'));
  if (a.engine === 'edit') d.items = items.map((l) => l.split('=>')[0]);
  delete d.model; delete d.models;
  return { ...a, data: d };
}
export function forStudents(l: Lesson): Lesson {
  return { ...l, tabs: l.tabs.map((t) => ({ ...t, notes: '', sections: t.sections.map((s) => ({ ...s, activities: s.activities.map((a) => ({ ...(t.kind === 'assessment' ? withoutKey(a) : a), notes: '' })) })) })) };
}

// An earlier Daily Procedure becomes a lesson: each phase is a tab and each page an activity that looks the same.
const PHASE_TAB: Record<string, TabKind> = { Opening: 'goal', Review: 'review', Instruction: 'instruction', Practice: 'practice', Application: 'application', Assessment: 'assessment' };
const KIND_PHASE: Record<string, string> = { goal: 'Opening', 'review-symbols': 'Review', formula: 'Instruction', activity: 'Practice', assessment: 'Assessment', custom: 'Practice' };
export function fromProcedure(p: Procedure): Lesson {
  const tabs: Tab[] = [];
  for (const page of p.pages) {
    const kind = PHASE_TAB[page.phase ?? KIND_PHASE[page.kind] ?? 'Practice'] ?? 'practice';
    let tab = tabs[tabs.length - 1];
    if (!tab || tab.kind !== kind) { tab = { id: newId(), kind, title: tabKindName(kind), notes: '', sections: [{ id: newId(), title: tabKindName(kind), activities: [] }] }; tabs.push(tab); }
    tab.sections[0].activities.push({
      id: newId(), preset: 'legacy', engine: 'legacy', title: page.title, about: page.minutes ?? '', directions: '', access: 'view', minutes: page.minutes, notes: page.notes,
      data: { kind: page.kind, page: page.data }, board: page.board,
    });
  }
  return { v: 2, id: p.id, title: p.title, subtitle: p.subtitle, folderId: p.folderId, updatedAt: p.updatedAt, saved: p.saved, focus: { symbols: [], formulas: [] }, progress: 'bar', tabs };
}
export const asLesson = (x: Lesson | Procedure): Lesson => ('v' in x && x.v === 2 ? x : fromProcedure(x as Procedure));
