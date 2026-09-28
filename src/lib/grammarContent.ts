import type { GrammarPiece } from '../types';

// Literacy Workspace — open-exploration sandbox. Direct teacher
// instruction: no rungs, no mastery gating, no rewards, no assignment
// structure — just a pool of draggable word pieces a student can pull
// onto an open canvas and snap together into silly, nonsense-but-
// grammatically-correct sentences, the "long lists of words, silly fun
// concepts" the very first brief for this feature asked for. Content
// grounded in the teacher's own uploaded Sentence Formulas curriculum
// (docs/curriculum-reference/sentence-formulas/) — same proper nouns,
// common nouns, and verbs from that document's word lists, plus her own
// established classroom characters (Yoga, Azalea, Xander, Geoff, Moxie)
// for continuity with content she's already using.
function piece(id: string, text: string, wordClass: 'noun' | 'verb', number: 'singular' | 'plural'): GrammarPiece {
  return { id, text, wordClass, number };
}

// Every noun is singular; a piece with number 'plural' is a genuinely
// different plural noun (not a second form of the same singular one) —
// unlike the old Rung 1 content, there's no fixed "correct pairing" to
// hit here, ANY noun and verb that agree in number are meant to snap.
export const SANDBOX_NOUNS: GrammarPiece[] = [
  piece('n-mom', 'Mom', 'noun', 'singular'),
  piece('n-dad', 'Dad', 'noun', 'singular'),
  piece('n-kayden', 'Ms. Kayden', 'noun', 'singular'),
  piece('n-mia', 'Mia', 'noun', 'singular'),
  piece('n-uncle-bill', 'Uncle Bill', 'noun', 'singular'),
  piece('n-yoga', 'Yoga', 'noun', 'singular'),
  piece('n-azalea', 'Azalea', 'noun', 'singular'),
  piece('n-xander', 'Xander', 'noun', 'singular'),
  piece('n-geoff', 'Geoff', 'noun', 'singular'),
  piece('n-moxie', 'Moxie the fox', 'noun', 'singular'),
  piece('n-dog', 'the dog', 'noun', 'singular'),
  piece('n-cat', 'the cat', 'noun', 'singular'),
  piece('n-teacher', 'my teacher', 'noun', 'singular'),
  piece('n-wizard', 'the wizard', 'noun', 'singular'),
  piece('n-dragon', 'a dragon', 'noun', 'singular'),
  piece('n-robot', 'a robot', 'noun', 'singular'),
  piece('n-dogs', 'the dogs', 'noun', 'plural'),
  piece('n-cats', 'the cats', 'noun', 'plural'),
  piece('n-children', 'the children', 'noun', 'plural'),
  piece('n-class', 'our class', 'noun', 'plural'),
  piece('n-wizards', 'the wizards', 'noun', 'plural'),
  piece('n-dragons', 'the dragons', 'noun', 'plural'),
];

export const SANDBOX_VERBS: GrammarPiece[] = [
  piece('v-run-sg', 'runs', 'verb', 'singular'),
  piece('v-run-pl', 'run', 'verb', 'plural'),
  piece('v-play-sg', 'plays', 'verb', 'singular'),
  piece('v-play-pl', 'play', 'verb', 'plural'),
  piece('v-sleep-sg', 'sleeps', 'verb', 'singular'),
  piece('v-sleep-pl', 'sleep', 'verb', 'plural'),
  piece('v-kick-sg', 'kicks', 'verb', 'singular'),
  piece('v-kick-pl', 'kick', 'verb', 'plural'),
  piece('v-eat-sg', 'eats', 'verb', 'singular'),
  piece('v-eat-pl', 'eat', 'verb', 'plural'),
  piece('v-work-sg', 'works', 'verb', 'singular'),
  piece('v-work-pl', 'work', 'verb', 'plural'),
  piece('v-arrive-sg', 'arrives', 'verb', 'singular'),
  piece('v-arrive-pl', 'arrive', 'verb', 'plural'),
  piece('v-teleport-sg', 'teleports', 'verb', 'singular'),
  piece('v-teleport-pl', 'teleport', 'verb', 'plural'),
  piece('v-wiggle-sg', 'wiggles', 'verb', 'singular'),
  piece('v-wiggle-pl', 'wiggle', 'verb', 'plural'),
  piece('v-pounce-sg', 'pounces', 'verb', 'singular'),
  piece('v-pounce-pl', 'pounce', 'verb', 'plural'),
];

export const SANDBOX_PIECES: GrammarPiece[] = [...SANDBOX_NOUNS, ...SANDBOX_VERBS];

// Mad Libs mode — Claudia's design pass confirmed this doesn't reopen the
// "no explicit activity" override: it's a different arrangement affordance
// for the same unscored SANDBOX_NOUNS/SANDBOX_VERBS pool (no new content,
// no validation, no correctness feedback, no completion state, no gating),
// grounded in the teacher's own curriculum reference, which already frames
// her "Yoga Comic Sentence Formulas" as silly Mad-Libs-style content
// (docs/curriculum-reference/sentence-formulas/README.md). A student taps
// a tray tile to fill the next empty blank of that word class; any noun
// fits any noun blank, any verb fits any verb blank — no "correct" answer.
export type MadlibSegment = { type: 'text'; value: string } | { type: 'blank'; wordClass: 'noun' | 'verb' };

const text = (value: string): MadlibSegment => ({ type: 'text', value });
const blank = (wordClass: 'noun' | 'verb'): MadlibSegment => ({ type: 'blank', wordClass });

export const MADLIB_TEMPLATES: MadlibSegment[][] = [
  [blank('noun'), text(' and '), blank('noun'), text(' '), blank('verb'), text(' together.')],
  [text('One day, '), blank('noun'), text(' '), blank('verb'), text(' all the way to '), blank('noun'), text("'s house.")],
  [blank('noun'), text(' said, "I bet '), blank('noun'), text(' can\'t '), blank('verb'), text('!"')],
  [blank('noun'), text(' '), blank('verb'), text(', then '), blank('noun'), text(' '), blank('verb'), text(' too.')],
  [text('According to '), blank('noun'), text(', '), blank('noun'), text(' always '), blank('verb'), text(' first.')],
  [blank('noun'), text(' wants to '), blank('verb'), text(' like '), blank('noun'), text('.')],
];
