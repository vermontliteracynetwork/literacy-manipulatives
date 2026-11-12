import type { Provenance } from './types';

// Pictures for words (build spec Phase 2): Twemoji graphics (CC BY 4.0), picked by scripts/build-word-explorer-pictures.py.
export const TWEMOJI: Provenance = {
  source: 'Twemoji graphics', license: 'CC BY 4.0',
  attribution: 'Twemoji, copyright Twitter, Inc and other contributors, CC BY 4.0', url: 'https://github.com/jdecked/twemoji',
};
let pics: Promise<Record<string, { file: string; name: string }>> | null = null;
export function pictureFor(word: string): Promise<{ file: string; name: string } | undefined> {
  pics ??= fetch('/word-explorer/pictures.json').then((r) => (r.ok ? r.json() : {})).catch(() => { pics = null; return {}; });
  return pics.then((p) => p[word]);
}
// Every picture at once (Browse and printables).
export function allPictures(): Promise<Record<string, { file: string; name: string }>> {
  pics ??= fetch('/word-explorer/pictures.json').then((r) => (r.ok ? r.json() : {})).catch(() => { pics = null; return {}; });
  return pics;
}
