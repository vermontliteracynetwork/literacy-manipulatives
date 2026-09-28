// Sound/letter-level content — the real gap Claudia's tool survey found:
// every existing Literacy Manipulatives mode (Sentence Grammar, Mad Libs,
// Morpheme Web, Word Lists) assumes a student can already decode. Nothing
// reached the sound/letter/blending level, which is exactly what Kayden's
// real students need ("grades 5-6 but currently academically very low, so
// early elementary skills are needed"). Ordinary, uncontroversial phonics
// knowledge only (regular single-syllable CVC/CVCe words, common
// digraphs) — deliberately NOT a reproduction of UFLI's specific
// published board/sequence, which stays blocked in this repo (this
// environment can't fetch/verify it). Same "ordinary vs.
// specialized-and-unverifiable" line already drawn for Morpheme Web's
// etymology content.

export interface SoundWord {
  id: string;
  word: string;
  // Real phoneme segments for Sound Boxes — one box per entry. For the
  // regular CVC/CVCe words used here, this equals the letter split
  // (no digraphs/blends in v1, so phoneme count == letter count, kept
  // simple and unambiguous rather than teaching digraph exceptions here).
  sounds: string[];
  // Letters in spelling order for the Blending Board (letter-by-letter
  // build-and-blend) — same string, split, for CVCe words the silent e
  // is its own tile (added last, doesn't get its own spoken sound).
  letters: string[];
  pattern: 'CVC' | 'CVCe';
  vowelSound: 'short-a' | 'short-e' | 'short-i' | 'short-o' | 'short-u' | 'long-a' | 'long-e' | 'long-i' | 'long-o' | 'long-u';
}

function cvc(word: string, vowelSound: SoundWord['vowelSound']): SoundWord {
  const letters = word.split('');
  return { id: `sw-${word}`, word, sounds: letters, letters, pattern: 'CVC', vowelSound };
}

function cvce(word: string, vowelSound: SoundWord['vowelSound']): SoundWord {
  const letters = word.split('');
  // Silent e doesn't get its own spoken sound — the vowel before it does
  // (long vowel), so sounds/letters differ in length here on purpose:
  // "cake" is 3 spoken sounds (c-A-k) but 4 letters.
  const sounds = letters.slice(0, -1);
  return { id: `sw-${word}`, word, sounds, letters, pattern: 'CVCe', vowelSound };
}

export const SOUND_WORDS: SoundWord[] = [
  cvc('cat', 'short-a'), cvc('map', 'short-a'), cvc('bag', 'short-a'), cvc('hat', 'short-a'),
  cvc('bed', 'short-e'), cvc('net', 'short-e'), cvc('leg', 'short-e'), cvc('hen', 'short-e'),
  cvc('pig', 'short-i'), cvc('sit', 'short-i'), cvc('win', 'short-i'), cvc('lid', 'short-i'),
  cvc('dog', 'short-o'), cvc('mop', 'short-o'), cvc('pot', 'short-o'), cvc('box', 'short-o'),
  cvc('sun', 'short-u'), cvc('cup', 'short-u'), cvc('bus', 'short-u'), cvc('mud', 'short-u'),
  cvce('cake', 'long-a'), cvce('gate', 'long-a'), cvce('name', 'long-a'),
  cvce('bike', 'long-i'), cvce('time', 'long-i'), cvce('kite', 'long-i'),
  cvce('home', 'long-o'), cvce('rope', 'long-o'), cvce('note', 'long-o'),
  cvce('cube', 'long-u'), cvce('tube', 'long-u'),
];

// Word Sorts (Words Their Way-style pattern sorting) — same SOUND_WORDS
// pool, grouped into named sort categories a student drags cards into.
// Two sorts to start: short-vowel sound (the most foundational sort for
// this skill level) and CVC-vs-CVCe (the "does it have a silent e"
// contrast, the next step up). More sorts can be added here later
// without touching the sandbox component itself.
export interface WordSort {
  id: string;
  label: string;
  buckets: { id: string; label: string; matches: (w: SoundWord) => boolean }[];
}

export const WORD_SORTS: WordSort[] = [
  {
    id: 'short-vowel',
    label: 'Short vowel sound',
    // All 5 short vowels, not a subset — a bucket-less word in a sort
    // activity (a CVC word whose real vowel has no matching bucket) is a
    // real design bug, not a harmless gap, so every SOUND_WORDS CVC entry
    // needs a real home here.
    buckets: [
      { id: 'a', label: 'short a', matches: (w) => w.vowelSound === 'short-a' },
      { id: 'e', label: 'short e', matches: (w) => w.vowelSound === 'short-e' },
      { id: 'i', label: 'short i', matches: (w) => w.vowelSound === 'short-i' },
      { id: 'o', label: 'short o', matches: (w) => w.vowelSound === 'short-o' },
      { id: 'u', label: 'short u', matches: (w) => w.vowelSound === 'short-u' },
    ],
  },
  {
    id: 'cvc-vs-cvce',
    label: 'CVC or CVCe (silent e)',
    buckets: [
      { id: 'cvc', label: 'CVC (no silent e)', matches: (w) => w.pattern === 'CVC' },
      { id: 'cvce', label: 'CVCe (silent e)', matches: (w) => w.pattern === 'CVCe' },
    ],
  },
];
