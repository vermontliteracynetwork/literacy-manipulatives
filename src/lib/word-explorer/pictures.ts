import type { Provenance } from './types';

// Pictures for words (build spec Phase 2): Twemoji graphics (CC BY 4.0), picked by scripts/build-word-explorer-pictures.py.
export const TWEMOJI: Provenance = {
  source: 'Twemoji graphics', license: 'CC BY 4.0',
  attribution: 'Twemoji, copyright Twitter, Inc and other contributors, CC BY 4.0', url: 'https://github.com/jdecked/twemoji',
};
// More pictures (her request 2026-11-17: commercial use, open source, free): Mulberry Symbols (CC BY-SA 4.0), picked by
// scripts/build-word-explorer-mulberry.py, one per part of speech ("cook" the verb, "apple" the noun).
export const MULBERRY: Provenance = {
  source: 'Mulberry Symbols', license: 'CC BY-SA 4.0',
  attribution: 'Mulberry Symbols, copyright Steve Lee, CC BY-SA 4.0', url: 'https://mulberrysymbols.org',
};
/** A word's pictures: `file` is its first picture; `by` has one picture per part of speech. */
export interface WordPicture { file: string; name: string; by?: Partial<Record<string, string>> }
export const provenanceOf = (file: string): Provenance => (file.includes('/pictures/m/') ? MULBERRY : TWEMOJI);
let pics: Promise<Record<string, WordPicture>> | null = null;
export function pictureFor(word: string): Promise<WordPicture | undefined> {
  pics ??= fetch('/word-explorer/pictures.json').then((r) => (r.ok ? r.json() : {})).catch(() => { pics = null; return {}; });
  return pics.then((p) => p[word]);
}
// Every picture at once (Browse and printables).
export function allPictures(): Promise<Record<string, WordPicture>> {
  pics ??= fetch('/word-explorer/pictures.json').then((r) => (r.ok ? r.json() : {})).catch(() => { pics = null; return {}; });
  return pics;
}
