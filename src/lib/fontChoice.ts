import { useEffect, useState } from 'react';

// The app's one font (her branding sheet, 2026-10-15): Inclusive Sans by default, and a teacher can switch the
// whole board to OpenDyslexic or school cursive in Settings. Remembered on this device.
export type FontChoice = 'inclusive' | 'dyslexic' | 'cursive';

export const FONT_OPTIONS: { id: FontChoice; name: string; family: string }[] = [
  { id: 'inclusive', name: 'Inclusive Sans', family: "'Inclusive Sans', system-ui, sans-serif" },
  { id: 'dyslexic', name: 'OpenDyslexic', family: "'OpenDyslexic', 'Inclusive Sans', sans-serif" },
  { id: 'cursive', name: 'Cursive', family: "'Playwrite US Trad', 'Inclusive Sans', cursive" },
];

const KEY = 'lm-font';
const read = (): FontChoice => {
  try {
    const v = localStorage.getItem(KEY);
    return FONT_OPTIONS.some((o) => o.id === v) ? (v as FontChoice) : 'inclusive';
  } catch {
    return 'inclusive';
  }
};

// Returns the current choice, a setter, and a number that changes once the font's files have loaded (pieces
// sized by their text re-measure on it).
export function useFontChoice() {
  const [font, setFont] = useState<FontChoice>(read);
  const [loaded, setLoaded] = useState(0);
  useEffect(() => {
    const opt = FONT_OPTIONS.find((o) => o.id === font) ?? FONT_OPTIONS[0];
    document.documentElement.style.setProperty('--lm-font', opt.family);
    try { localStorage.setItem(KEY, font); } catch { /* private mode: just not remembered */ }
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
