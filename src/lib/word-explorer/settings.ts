// Word Explorer settings, kept per device (spec section 9; teacher locks come in Phase 5).
export type Theme = 'light' | 'dark' | 'contrast';
export type TextSize = 'medium' | 'large' | 'xl';
export interface WxSettings {
  theme: Theme;
  textSize: TextSize;
  speed: number;           // reading speed, 0.6 to 1.3
  sayButtons: boolean;     // read button names aloud when tapped
  teacherView: boolean;    // shows drafts, review buttons and sources
  // Word of the Day (spec 4.1): one word for the class or one per student; where it comes from; no repeats for N days.
  wotdFor: 'class' | 'student';
  wotdFrom: 'any' | 'tier1' | 'tier2' | 'tier3' | 'pattern' | 'root';
  wotdPattern: string;     // a pattern id from the Sounds list, when wotdFrom is 'pattern'
  wotdRepeatDays: number;
  browseView: 'cards' | 'list'; // Browse results as picture cards or a plain list
}
export const DEFAULT_SETTINGS: WxSettings = { theme: 'light', textSize: 'medium', speed: 0.9, sayButtons: true, teacherView: false,
  wotdFor: 'class', wotdFrom: 'any', wotdPattern: 'ai', wotdRepeatDays: 30, browseView: 'cards' };
const KEY = 'wx-settings-v1';
export function readSettings(): WxSettings {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return DEFAULT_SETTINGS; }
}
export function saveSettings(s: WxSettings) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* not saved */ } }

// Recent words (the Home screen's Recent chips).
const RECENT = 'wx-recent-v1';
export function readRecent(): string[] { try { return JSON.parse(localStorage.getItem(RECENT) ?? '[]'); } catch { return []; } }
export function pushRecent(word: string): string[] {
  const next = [word, ...readRecent().filter((w) => w !== word)].slice(0, 12);
  try { localStorage.setItem(RECENT, JSON.stringify(next)); } catch { /* not saved */ }
  return next;
}
