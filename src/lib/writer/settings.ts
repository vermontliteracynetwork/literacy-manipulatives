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
}

export const DEFAULT_WRITER_SETTINGS: WriterSettings = {
  spell: 'suggest', predict: 'suggest', autoCap: true, grammar: 'end', symbols: 'above', symbolSize: 'medium', blockAddons: true, level: 'A',
};

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
