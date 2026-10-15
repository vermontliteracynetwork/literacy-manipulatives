import { useEffect, useState } from 'react';
import dys400 from '@fontsource/opendyslexic/files/opendyslexic-latin-400-normal.woff2';
import dys700 from '@fontsource/opendyslexic/files/opendyslexic-latin-700-normal.woff2';

// OpenDyslexic runs large and wide next to Inclusive Sans, so it gets its own face drawn at 85% size: it then
// fits the same buttons, bubbles and pieces everywhere (her request 2026-10-15).
const DYSLEXIC_FACE = 'OpenDyslexic LM';
if (typeof document !== 'undefined' && 'fonts' in document) {
  for (const [url, weight] of [[dys400, '400'], [dys700, '700']] as const) {
    const face = new FontFace(DYSLEXIC_FACE, `url(${url}) format('woff2')`, { weight, style: 'normal', display: 'swap', sizeAdjust: '85%' } as FontFaceDescriptors);
    document.fonts.add(face);
  }
}

// The app's one font (her branding sheet, 2026-10-15): Inclusive Sans by default, and a teacher can switch the
// whole board to OpenDyslexic or school cursive in Settings. Remembered on this device.
export type FontChoice = 'inclusive' | 'dyslexic' | 'cursive';

export const FONT_OPTIONS: { id: FontChoice; name: string; family: string }[] = [
  { id: 'inclusive', name: 'Inclusive Sans', family: "'Inclusive Sans', system-ui, sans-serif" },
  { id: 'dyslexic', name: 'OpenDyslexic', family: `'${DYSLEXIC_FACE}', 'Inclusive Sans', sans-serif` },
  { id: 'cursive', name: 'Cursive', family: "'Playwrite US Trad', 'Inclusive Sans', cursive" },
];

const KEY = 'lm-font';
const read = (): FontChoice => {
  try {
    const v = localStorage.getItem(KEY);
    return isFontChoice(v) ? v : 'inclusive';
  } catch {
    return 'inclusive';
  }
};

// Returns the current choice, a setter, and a number that changes once the font's files have loaded (pieces
// sized by their text re-measure on it).
// `override` is the teacher's choice on a shared board: a student's screen follows it without changing what
// that device remembers for its own boards.
export const isFontChoice = (v: unknown): v is FontChoice => FONT_OPTIONS.some((o) => o.id === v);
export function useFontChoice(override?: FontChoice | null) {
  const [own, setFont] = useState<FontChoice>(read);
  const [loaded, setLoaded] = useState(0);
  const font = override ?? own;
  useEffect(() => {
    if (!override) { try { localStorage.setItem(KEY, own); } catch { /* private mode: just not remembered */ } }
  }, [own, override]);
  useEffect(() => {
    const opt = FONT_OPTIONS.find((o) => o.id === font) ?? FONT_OPTIONS[0];
    document.documentElement.style.setProperty('--lm-font', opt.family);
    let alive = true;
    const first = opt.family.split(',')[0];
    void Promise.all([document.fonts.load(`400 22px ${first}`), document.fonts.load(`700 22px ${first}`)])
      .catch(() => undefined)
      .then(() => document.fonts.ready)
      .then(() => { if (alive) setLoaded((n) => n + 1); });
    return () => { alive = false; };
  }, [font]);
  return { font, setFont, loaded };
}
