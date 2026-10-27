// The Writer's environment, set by the teacher (2026-10-27). On a shared board students get these with the
// board and can't change them.
export interface WriterSettings {
  spell: 'off' | 'mark' | 'suggest';
  predict: 'off' | 'suggest' | 'auto';
  autoCap: boolean;
  grammar: 'off' | 'end' | 'live';
  symbols: 'off' | 'above' | 'below';
  symbolSize: 'small' | 'medium' | 'large';
  blockAddons: boolean;
  level: 'A' | 'B' | 'C';
  // Accessibility (Claudia's research, 2026-10-27). Tools that change what the student produces or hears back
  // are set by the teacher: 'on', 'off', or 'choice' (the student may switch it in My tools). Tools that only
  // change how the page looks are the student's choice; the teacher sets where they start.
  readAloud: 'off' | 'on' | 'choice';
  typingEcho: 'off' | 'words' | 'sentences' | 'choice';
  spacing: 'normal' | 'wide' | 'wider';
  lineFocus: boolean;
  theme: 'default' | 'high' | 'dark' | 'cream';
  focusMode: boolean;
}

export const DEFAULT_WRITER_SETTINGS: WriterSettings = {
  spell: 'suggest', predict: 'suggest', autoCap: true, grammar: 'end', symbols: 'above', symbolSize: 'medium', blockAddons: true, level: 'A',
  readAloud: 'choice', typingEcho: 'off', spacing: 'normal', lineFocus: false, theme: 'default', focusMode: false,
};

// The student's own picks in My tools, kept on their device.
export interface StudentTools { readAloud?: boolean; typingEcho?: 'off' | 'words' | 'sentences'; spacing?: WriterSettings['spacing']; lineFocus?: boolean; theme?: WriterSettings['theme']; focusMode?: boolean; rate?: number }
const MINE = 'lm-writer-mine';
export function readStudentTools(): StudentTools { try { return JSON.parse(localStorage.getItem(MINE) ?? '{}'); } catch { return {}; } }
export function saveStudentTools(t: StudentTools) { try { localStorage.setItem(MINE, JSON.stringify(t)); } catch { /* not remembered */ } }

const KEY = 'lm-writer-settings';
export function readWriterSettings(): WriterSettings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_WRITER_SETTINGS, ...JSON.parse(raw) } : DEFAULT_WRITER_SETTINGS;
  } catch {
    return DEFAULT_WRITER_SETTINGS;
  }
}
export function saveWriterSettings(s: WriterSettings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* not remembered */ }
}
export const isWriterSettings = (v: unknown): v is WriterSettings => !!v && typeof v === 'object' && 'spell' in (v as object) && 'grammar' in (v as object);
