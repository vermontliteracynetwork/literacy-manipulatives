// Heart Words — A23-ROADMAP Phase 3 ("heart-word marking, reusing the
// Morphemes 'connects only if real, never punitive' pattern"). A "heart
// word" is the common name for a high-frequency word with an irregular
// part that doesn't sound the way it's spelled (the part you have to
// "know by heart"). Real, ordinary high-frequency English words, not a
// specialized curriculum standard.
//
// Judgment call, logged per this task's own instruction to make the
// smallest reversible call rather than stall or invent unearned
// authority: this file intentionally does NOT hand-tag which letters
// are "the heart part" of each word. Different heart-word programs mark
// the irregular part slightly differently, and this environment has no
// way to verify against any one specific published program (the same
// standing limitation already logged for the Graphemes/UFLI scope
// elsewhere in this file's sibling data files). Instead, GrammarSandbox
// lets the student mark the tricky letters themselves by tapping them —
// self-directed, exactly like the Syllable Tapper's self-counted claps
// — rather than asserting a possibly-wrong "correct" heart placement.
export interface HeartWord {
  id: string;
  word: string;
}

export const HEART_WORDS: HeartWord[] = [
  { id: 'hw-the', word: 'the' },
  { id: 'hw-was', word: 'was' },
  { id: 'hw-said', word: 'said' },
  { id: 'hw-of', word: 'of' },
  { id: 'hw-you', word: 'you' },
  { id: 'hw-they', word: 'they' },
  { id: 'hw-are', word: 'are' },
  { id: 'hw-were', word: 'were' },
  { id: 'hw-what', word: 'what' },
  { id: 'hw-would', word: 'would' },
  { id: 'hw-could', word: 'could' },
  { id: 'hw-should', word: 'should' },
  { id: 'hw-does', word: 'does' },
  { id: 'hw-one', word: 'one' },
  { id: 'hw-once', word: 'once' },
  { id: 'hw-friend', word: 'friend' },
  { id: 'hw-because', word: 'because' },
  { id: 'hw-people', word: 'people' },
  { id: 'hw-again', word: 'again' },
  { id: 'hw-give', word: 'give' },
];
