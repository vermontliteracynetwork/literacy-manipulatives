import list from './blocklist.json';

// The kid-safe filter (spec section 10): runs before any lookup and on every result, per word and per meaning.
// The same list is applied when the dictionary data is built (scripts/build-word-explorer-data.py).
const WORDS = new Set(list.words.map((w) => w.toLowerCase()));
const TERMS = new RegExp(`\\b(${list.meaningTerms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'i');

const key = (w: string) => w.trim().toLowerCase().replace(/[’]/g, "'").replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '');

export function isBlockedTerm(word: string): boolean {
  const w = key(word);
  if (!w) return false;
  if (WORDS.has(w)) return true;
  // Plurals and endings of a blocked word ("wounds", "bleeding").
  for (const end of ['s', 'es', 'ed', 'ing', 'er', 'ers', 'y']) {
    if (w.endsWith(end) && WORDS.has(w.slice(0, -end.length))) return true;
  }
  return false;
}

export function isBlockedText(text: string): boolean {
  if (TERMS.test(text)) return true;
  return text.split(/[^A-Za-z'’]+/).some((w) => w && isBlockedTerm(w));
}
