// Word Explorer settings (spec section 9 and Phase 5), kept per device: a student's device is that student's
// settings until accounts exist. A teacher can lock any setting and any Word List Maker filter, behind a teacher PIN.
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
  lineSpacing: 'standard' | 'more' | 'most';
  spacing: 'standard' | 'wider' | 'widest'; // letter and word spacing always change together
  font: 'inclusive' | 'dyslexic' | 'system'; // a personal preference only
  buttonSize: 'standard' | 'xl';            // 44 px or 56 px touch targets
  reduceMotion: boolean;                    // on by default
  calm: boolean;                            // hides extras
  preset: Preset;                           // view preset for word pages
  liveLookups: boolean;                     // teacher: allow outside dictionaries (off by default)
  locks: string[];                          // settings a teacher locked for this student
  lockedBlocks: Record<string, unknown>;    // Word List Maker filters a teacher locked (with their values)
  pinHash: string;                          // teacher PIN (hashed); empty until set
}
export type Preset = 'full' | 'simple' | 'grammar' | 'wordstudy' | 'thesaurus';
export const PRESETS: [Preset, string, string][] = [
  ['simple', 'Simple', 'Picture, explanation and one example'],
  ['full', 'Full', 'Everything'],
  ['grammar', 'Grammar', 'Dictionary and Thesaurus, with grammar notes'],
  ['wordstudy', 'Word study', 'Dictionary, Sounds and Word Parts'],
  ['thesaurus', 'Thesaurus', 'Dictionary, Thesaurus and Pictures'],
];
// Simple hash so the PIN is not stored as typed (this keeps students out of Teacher view; it is not a password).
export function hashPin(pin: string): string { let h = 5381; for (const c of `wx:${pin}`) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return h.toString(36); }
export const isLocked = (s: WxSettings, key: string) => !s.teacherView && s.locks.includes(key);
export const DEFAULT_SETTINGS: WxSettings = { theme: 'light', textSize: 'medium', speed: 0.9, sayButtons: true, teacherView: false,
  wotdFor: 'class', wotdFrom: 'any', wotdPattern: 'ai', wotdRepeatDays: 30, browseView: 'cards',
  lineSpacing: 'standard', spacing: 'standard', font: 'inclusive', buttonSize: 'standard', reduceMotion: true, calm: false,
  preset: 'full', liveLookups: false, locks: [], lockedBlocks: {}, pinHash: '' };
const KEY = 'wx-settings-v1';
export function readSettings(): WxSettings {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return DEFAULT_SETTINGS; }
}
export function saveSettings(s: WxSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    // The live lookups setting is shared with the other tools (src/lib/wordTypes.ts, src/lib/dictionary.ts).
    localStorage.setItem(LIVE_KEY, s.liveLookups ? 'on' : 'off');
  } catch { /* not saved */ }
}
export const LIVE_KEY = 'lm-live-lookups';

// Reports from "Report a problem" (spec section 10), kept on this device.
export interface Report { id: string; word: string; part: string; note: string; at: string; fixed?: boolean }
const REPORTS = 'wx-reports-v1';
export function readReports(): Report[] { try { return JSON.parse(localStorage.getItem(REPORTS) ?? '[]'); } catch { return []; } }
export function writeReports(r: Report[]) { try { localStorage.setItem(REPORTS, JSON.stringify(r)); } catch { /* not saved */ } }

// Recent words (the Home screen's Recent chips).
const RECENT = 'wx-recent-v1';
export function readRecent(): string[] { try { return JSON.parse(localStorage.getItem(RECENT) ?? '[]'); } catch { return []; } }
export function pushRecent(word: string): string[] {
  const next = [word, ...readRecent().filter((w) => w !== word)].slice(0, 12);
  try { localStorage.setItem(RECENT, JSON.stringify(next)); } catch { /* not saved */ }
  return next;
}
