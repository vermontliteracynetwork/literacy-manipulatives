import type { TTSSettings } from '../types';

// Standalone version of the dashboard's ReadAloud.tsx buildUtterance —
// this v1 has no accounts and no marketplace voice skins, so it only
// ever resolves plain browser TTS settings (rate + a chosen system
// voice), never a purchased "voice skin" or an NPC voice profile.
export function buildUtterance(text: string, settings?: TTSSettings): SpeechSynthesisUtterance {
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = settings?.rate ?? 1;
  if (settings?.voiceURI) {
    const voice = window.speechSynthesis.getVoices().find((v) => v.voiceURI === settings.voiceURI);
    if (voice) utter.voice = voice;
  }
  return utter;
}
