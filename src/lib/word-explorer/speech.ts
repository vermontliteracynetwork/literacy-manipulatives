// Read aloud for Word Explorer (spec section 9): the most human-sounding voice the device has, a speed setting,
// and word-by-word callbacks for highlighting. UI-free.
//
// Note: the spec names api/tts.ts (a human neural voice with the device voice as backup). That endpoint does not
// exist in this repo yet, so this uses the device's best voice only; swap speakWith() to call it when it lands.

const PREFERRED = [/natural/i, /neural/i, /premium/i, /enhanced/i, /siri/i, /^samantha/i, /^ava/i, /^allison/i, /^susan/i, /google us english/i, /^aria/i, /^jenny/i];
const ROBOTIC = /(espeak|compact|fred|albert|zarvox|trinoids|whisper|bad news|bells|boing|bubbles|cellos|jester|organ|superstar|wobble)/i;
let chosen: SpeechSynthesisVoice | null | undefined;

export function bestVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  if (chosen !== undefined) return chosen;
  const voices = window.speechSynthesis.getVoices().filter((v) => /^en(-|_|$)/i.test(v.lang) && !ROBOTIC.test(v.name));
  if (!voices.length) return null; // voices not loaded yet; try again next time
  const score = (v: SpeechSynthesisVoice) => {
    const p = PREFERRED.findIndex((re) => re.test(v.name));
    return (p < 0 ? 100 : p) + (/en[-_]US/i.test(v.lang) ? 0 : 20) + (v.localService ? 0 : 1);
  };
  chosen = [...voices].sort((a, b) => score(a) - score(b))[0] ?? null;
  return chosen;
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.addEventListener?.('voiceschanged', () => { chosen = undefined; });
}

export interface SpeakOptions { rate?: number; onWord?: (index: number) => void; onEnd?: () => void }

// Splits text into the words a highlighter shows, so onWord's index lines up with them.
export const speechWords = (text: string) => text.split(/\s+/).filter(Boolean);

export function speak(text: string, opts: SpeakOptions = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text.trim()) { opts.onEnd?.(); return; }
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = bestVoice();
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
  u.rate = opts.rate ?? 0.9;
  const starts: number[] = [];
  text.replace(/\S+/g, (m, at: number) => { starts.push(at); return m; });
  u.onboundary = (e) => {
    if (e.name && e.name !== 'word') return;
    let i = 0;
    while (i + 1 < starts.length && starts[i + 1] <= e.charIndex) i++;
    opts.onWord?.(i);
  };
  u.onend = () => opts.onEnd?.();
  u.onerror = () => opts.onEnd?.();
  synth.speak(u);
}

export function stopSpeaking() {
  try { window.speechSynthesis.cancel(); } catch { /* not supported */ }
}
