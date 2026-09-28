// Speech-to-text listening cue — A23-ROADMAP Phase 2 ("STT listening cue:
// chime/TTS + visual state"). Every existing STT button in Literacy
// Manipulatives (Text Box, Sentence Formula blanks) already flips a
// visual state when listening starts/stops (a button label/style
// change); this adds the paired audio chime, a short two-tone beep built
// with the Web Audio API so it needs no external sound file and works
// offline. Feature-detected: silently does nothing if AudioContext isn't
// available, never throws or blocks the STT feature itself.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AudioContextCtor: any = typeof window !== 'undefined' ? (window as any).AudioContext ?? (window as any).webkitAudioContext : null;

function beep(freq: number, startAt: number, durationSec: number, ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.001, ctx.currentTime + startAt);
  gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + durationSec);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + startAt);
  osc.stop(ctx.currentTime + startAt + durationSec + 0.02);
}

// A rising two-note chime — "I'm listening now."
export function playListeningStartChime() {
  if (!AudioContextCtor) return;
  try {
    const ctx: AudioContext = new AudioContextCtor();
    beep(660, 0, 0.09, ctx);
    beep(880, 0.1, 0.12, ctx);
    window.setTimeout(() => ctx.close?.(), 400);
  } catch { /* audio not available, no cue, no crash */ }
}

// A single falling note — "stopped listening."
export function playListeningStopChime() {
  if (!AudioContextCtor) return;
  try {
    const ctx: AudioContext = new AudioContextCtor();
    beep(520, 0, 0.1, ctx);
    window.setTimeout(() => ctx.close?.(), 300);
  } catch { /* audio not available, no cue, no crash */ }
}
