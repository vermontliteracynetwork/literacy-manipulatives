import { useCallback, useEffect, useRef, useState } from 'react';
import type { TTSSettings } from '../types';
import { buildUtterance } from '../lib/tts';

// TTS with synced word-highlighting, ported as-is from the dashboard's
// components/SyncedSpeakButton.tsx — one shared hook so every 🔈 button
// on this board reads through the same engine, and starting a new one
// cleanly stops whatever was already reading. The only change from the
// dashboard version: no `voiceSkinId` param — this standalone v1 has no
// accounts/marketplace, so there's no purchased voice skin to resolve.

export interface SyncedTTS {
  activeId: string | null;
  wordIndex: number;
  speakSynced: (id: string, text: string, settings?: TTSSettings) => void;
  stop: () => void;
}

function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((t) => t.length > 0);
}

function wordIndexAtChar(text: string, charIndex: number): number {
  const tokens = tokenize(text);
  let pos = 0;
  let wordNum = -1;
  for (const t of tokens) {
    const isWord = !/^\s+$/.test(t);
    if (isWord) wordNum++;
    if (charIndex >= pos && charIndex < pos + t.length) return isWord ? wordNum : wordNum + 1;
    pos += t.length;
  }
  return wordNum;
}

export function useSyncedTTS(): SyncedTTS {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [wordIndex, setWordIndex] = useState(-1);
  const activeTextRef = useRef<string>('');

  useEffect(() => () => { try { window.speechSynthesis.cancel(); } catch { /* not supported */ } }, []);

  const stop = useCallback(() => {
    try { window.speechSynthesis.cancel(); } catch { /* not supported */ }
    setActiveId(null);
    setWordIndex(-1);
  }, []);

  const speakSynced = useCallback((id: string, text: string, settings?: TTSSettings) => {
    if (!('speechSynthesis' in window) || !text) return;
    window.speechSynthesis.cancel();
    activeTextRef.current = text;
    const utter = buildUtterance(text, settings);
    utter.onboundary = (e) => {
      if (activeTextRef.current !== text) return;
      setWordIndex(wordIndexAtChar(text, e.charIndex));
    };
    utter.onstart = () => setActiveId(id);
    utter.onend = () => { setActiveId(null); setWordIndex(-1); };
    utter.onerror = () => { setActiveId(null); setWordIndex(-1); };
    window.speechSynthesis.speak(utter);
  }, []);

  return { activeId, wordIndex, speakSynced, stop };
}

export function HighlightedText({ text, active, wordIndex, style }: {
  text: string; active: boolean; wordIndex: number; style?: React.CSSProperties;
}) {
  const tokens = tokenize(text);
  let wordNum = -1;
  return (
    <span style={style}>
      {tokens.map((t, i) => {
        const isWord = !/^\s+$/.test(t);
        if (isWord) wordNum++;
        const highlighted = active && isWord && wordNum === wordIndex;
        return (
          <span
            key={i}
            style={highlighted ? { background: '#fde047', borderRadius: 3, boxShadow: '0 0 0 2px #fde047' } : undefined}
          >
            {t}
          </span>
        );
      })}
    </span>
  );
}

export function SyncedSpeakButton({ id, text, tts, settings, label, ariaLabel, className, style }: {
  id: string;
  text: string;
  tts: SyncedTTS;
  settings?: TTSSettings;
  label?: string;
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const speaking = tts.activeId === id;
  return (
    <button
      type="button"
      className={className ?? 'btn btn-sm'}
      onClick={() => (speaking ? tts.stop() : tts.speakSynced(id, text, settings))}
      aria-label={ariaLabel ?? (label ? `Hear ${label}` : 'Hear this read aloud')}
      style={style}
    >
      {speaking ? '🔊' : '🔈'}
    </button>
  );
}
