import { rawWord } from './word-explorer/data';
import { liveLookupsAllowed } from './wordTypes';
// Real definitions for words built from morpheme pieces, from the free Dictionary API
// (https://dictionaryapi.dev, no key needed). Each word is looked up once per visit and remembered.

// `parts` lists every part of speech the dictionary gives the word (noun, verb, adjective...).
export interface Definition { text: string | null; partOfSpeech?: string; parts?: string[] }

const cache = new Map<string, Definition>();
const pending = new Map<string, Promise<Definition>>();

// undefined while a word hasn't been looked up yet; text is null when the dictionary doesn't know it.
export const peekDefinition = (word: string): Definition | undefined => cache.get(word.toLowerCase());

export function lookupDefinition(word: string): Promise<Definition> {
  const key = word.toLowerCase();
  // Live lookups are off unless a teacher allows them (Word Explorer Settings, "Allow live lookups"); then the
  // meaning comes from Word Explorer's own dictionary data (Open English WordNet, on this site).
  if (!liveLookupsAllowed()) {
    const known = cache.get(key);
    if (known) return Promise.resolve(known);
    return rawWord(key).then((r): Definition => {
      const d: Definition = r ? { text: r.parts[0]?.senses[0]?.def ?? null, partOfSpeech: r.parts[0]?.pos, parts: r.parts.map((p) => p.pos) } : { text: null };
      cache.set(key, d);
      return d;
    }).catch((): Definition => ({ text: null }));
  }
  const known = cache.get(key);
  if (known) return Promise.resolve(known);
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;
  const p = fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`)
    .then(async (res): Promise<Definition> => {
      if (!res.ok) return { text: null };
      const data = (await res.json()) as { meanings?: { partOfSpeech?: string; definitions?: { definition?: string }[] }[] }[];
      const parts = [...new Set(data.flatMap((entry) => (entry.meanings ?? []).map((m) => m.partOfSpeech ?? '').filter(Boolean)))];
      for (const entry of data) {
        for (const meaning of entry.meanings ?? []) {
          const text = meaning.definitions?.find((d) => d.definition)?.definition;
          if (text) return { text, partOfSpeech: meaning.partOfSpeech, parts };
        }
      }
      return { text: null, parts };
    })
    .catch((): Definition => ({ text: null }))
    .then((d) => { cache.set(key, d); pending.delete(key); return d; });
  pending.set(key, p);
  return p;
}
