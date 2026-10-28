// The Writer's environment, set by the teacher (2026-10-27). On a shared board students get these with the
// board and can't change them; on their own device (not joined to a board) students have every setting.
export interface WriterSettings {
  // Spell check (her answer 2026-10-28): which words get marked, and how much help comes with the mark.
  // 'common' marks only misspellings of the 4,000 most common words, for younger writers.
  spell: 'off' | 'common' | 'all';
  spellHelp: 'mark' | 'suggest';
  predict: 'off' | 'suggest' | 'auto';
  autoCap: boolean;
  // The Sentence Check runs only when the student or teacher asks for it on a sentence (her note 2026-10-28).
  grammar: 'off' | 'on';
  // Who ticks the Sentence Check list: the Writer ('auto') or the student ('self'), who then sees an open spot
  // wherever an item they ticked isn't done yet.
  checkStyle: 'auto' | 'self' | 'choice';
  // Grammar symbols always sit above the words, centered on each word (her answer 2026-10-28).
  symbols: 'off' | 'on' | 'choice';
  symbolSize: 'small' | 'medium' | 'large';
  blockAddons: boolean;
  level: 'A' | 'B' | 'C';
  // Accessibility (Claudia's research, 2026-10-27). Tools that change what the student produces or hears back
  // are set by the teacher: 'on', 'off', or 'choice' (the student may switch it in My tools). Tools that only
  // change how the page looks are the student's choice; the teacher sets where they start.
  readAloud: 'off' | 'on' | 'choice';
  typingEcho: 'off' | 'words' | 'sentences' | 'choice';
  dictation: 'off' | 'on' | 'choice';
  letterSpacing: Spacing;
  lineSpacing: Spacing;
  wordSpacing: Spacing;
  lineFocus: boolean;
  theme: 'default' | 'high' | 'dark' | 'cream';
  focusMode: boolean;
}

export type Spacing = 'normal' | 'wide' | 'wider';

export const DEFAULT_WRITER_SETTINGS: WriterSettings = {
  spell: 'all', spellHelp: 'suggest', predict: 'suggest', autoCap: true, grammar: 'on', checkStyle: 'auto', symbols: 'on', symbolSize: 'medium',
  blockAddons: true, level: 'A', readAloud: 'choice', typingEcho: 'off', dictation: 'choice', letterSpacing: 'normal', lineSpacing: 'normal', wordSpacing: 'normal', lineFocus: false, theme: 'default',
  focusMode: false,
};

// Settings saved (or sent by a teacher) before 2026-10-28 used other values; bring them up to date.
export function normalizeWriterSettings(raw: Record<string, unknown>): WriterSettings {
  const s = { ...DEFAULT_WRITER_SETTINGS, ...raw } as WriterSettings & Record<string, unknown>;
  if (raw.spell === 'mark' || raw.spell === 'suggest') { s.spell = 'all'; if (!('spellHelp' in raw)) s.spellHelp = raw.spell; }
  if (raw.symbols === 'above' || raw.symbols === 'below') s.symbols = 'on';
  if (raw.grammar === 'end' || raw.grammar === 'live') s.grammar = 'on';
  const old = raw.spacing as Spacing | undefined;
  if (old && !('letterSpacing' in raw)) { s.letterSpacing = old; s.lineSpacing = old; s.wordSpacing = old; }
  return s;
}

// The student's own picks in My tools, kept on their device.
export interface StudentTools {
  readAloud?: boolean; typingEcho?: 'off' | 'words' | 'sentences'; dictation?: boolean; symbols?: boolean; checkStyle?: 'auto' | 'self';
  letterSpacing?: Spacing; lineSpacing?: Spacing; wordSpacing?: Spacing; spacing?: Spacing; lineFocus?: boolean; theme?: WriterSettings['theme']; focusMode?: boolean; rate?: number;
}
const MINE = 'lm-writer-mine';
export function readStudentTools(): StudentTools { try { return JSON.parse(localStorage.getItem(MINE) ?? '{}'); } catch { return {}; } }
export function saveStudentTools(t: StudentTools) { try { localStorage.setItem(MINE, JSON.stringify(t)); } catch { /* not remembered */ } }

const KEY = 'lm-writer-settings';
export function readWriterSettings(): WriterSettings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalizeWriterSettings(JSON.parse(raw)) : DEFAULT_WRITER_SETTINGS;
  } catch {
    return DEFAULT_WRITER_SETTINGS;
  }
}
export function saveWriterSettings(s: WriterSettings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* not remembered */ }
}
export const isWriterSettings = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && 'spell' in (v as object) && 'grammar' in (v as object);
