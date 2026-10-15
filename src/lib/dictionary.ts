// Real definitions for words built from morpheme pieces, from the free Dictionary API
// (https://dictionaryapi.dev, no key needed). Each word is looked up once per visit and remembered.

export interface Definition { text: string | null; partOfSpeech?: string }

const cache = new Map<string, Definition>();
const pending = new Map<string, Promise<Definition>>();

// undefined while a word hasn't been looked up yet; text is null when the dictionary doesn't know it.
export const peekDefinition = (word: string): Definition | undefined => cache.get(word.toLowerCase());

export function lookupDefinition(word: string): Promise<Definition> {
  const key = word.toLowerCase();
  const known = cache.get(key);
  if (known) return Promise.resolve(known);
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;
  const p = fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`)
    .then(async (res): Promise<Definition> => {
      if (!res.ok) return { text: null };
      const data = (await res.json()) as { meanings?: { partOfSpeech?: string; definitions?: { definition?: string }[] }[] }[];
      for (const entry of data) {
        for (const meaning of entry.meanings ?? []) {
          const text = meaning.definitions?.find((d) => d.definition)?.definition;
          if (text) return { text, partOfSpeech: meaning.partOfSpeech };
        }
      }
      return { text: null };
    })
    .catch((): Definition => ({ text: null }))
    .then((d) => { cache.set(key, d); pending.delete(key); return d; });
  pending.set(key, p);
  return p;
}
