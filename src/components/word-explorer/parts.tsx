import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { speak, speechWords, stopSpeaking } from '../../lib/word-explorer/speech';
import { GRAMMAR_SYMBOL_INFO } from '../../lib/grammarSymbols';
import type { PartOfSpeech, ReviewStatus } from '../../lib/word-explorer/types';

// Small shared pieces for Word Explorer: the reader (read aloud with word highlighting), tappable words, the
// part of speech symbol and the speak button.

// ---------- the reader ----------
interface Reader { active: string | null; word: number; read: (id: string, text: string, rate?: number) => void; stop: () => void }
const ReaderCtx = createContext<Reader>({ active: null, word: -1, read: () => {}, stop: () => {} });
export const useReader = () => useContext(ReaderCtx);

export function ReaderProvider({ rate, children }: { rate: number; children: React.ReactNode }) {
  const [active, setActive] = useState<string | null>(null);
  const [word, setWord] = useState(-1);
  const read = useCallback((id: string, text: string, r?: number) => {
    setActive(id); setWord(-1);
    speak(text, { rate: r ?? rate, onWord: setWord, onEnd: () => { setActive((a) => (a === id ? null : a)); setWord(-1); } });
  }, [rate]);
  const stop = useCallback(() => { stopSpeaking(); setActive(null); setWord(-1); }, []);
  useEffect(() => () => stopSpeaking(), []);
  return <ReaderCtx.Provider value={{ active, word, read, stop }}>{children}</ReaderCtx.Provider>;
}

// Text that lights up word by word while it is read. `offset` is how many words come before it in the same reading.
export function Spoken({ id, text, offset = 0 }: { id: string; text: string; offset?: number }) {
  const { active, word } = useReader();
  if (active !== id) return <>{text}</>;
  const parts = text.split(/(\s+)/);
  let n = offset - 1;
  return <>{parts.map((p, i) => { if (/^\s+$/.test(p) || !p) return p; n++; return <span key={i} className={n === word ? 'wx-reading' : undefined}>{p}</span>; })}</>;
}
export const wordCount = (t: string) => speechWords(t).length;

// The read aloud button. `text` is what is read; `label` names it for VoiceOver ("Read the meaning").
export function SpeakButton({ id, text, label, size = 'md', rate }: { id: string; text: string; label: string; size?: 'md' | 'lg'; rate?: number }) {
  const { active, read, stop } = useReader();
  const on = active === id;
  return (
    <button type="button" data-nosay className={`wx-speak wx-speak-${size}${on ? ' on' : ''}`} aria-label={on ? 'Stop reading' : label} aria-pressed={on}
      onClick={() => (on ? stop() : read(id, text, rate))}>
      <Icon name={on ? 'speaking' : 'speaker'} size={size === 'lg' ? 28 : 22} />
    </button>
  );
}

// ---------- tappable words: one tap says it, a second tap opens it ----------
interface TapCtx { armed: string | null; arm: (w: string | null) => void; open: (w: string) => void }
const TapContext = createContext<TapCtx>({ armed: null, arm: () => {}, open: () => {} });
export function TapProvider({ open, children }: { open: (w: string) => void; children: React.ReactNode }) {
  const [armed, setArmed] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const arm = useCallback((w: string | null) => {
    window.clearTimeout(timer.current);
    setArmed(w);
    if (w) timer.current = window.setTimeout(() => setArmed(null), 6000);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return <TapContext.Provider value={{ armed, arm, open }}>{children}</TapContext.Provider>;
}

export function TapWord({ word, pos, className = '', bold = false }: { word: string; pos?: PartOfSpeech; className?: string; bold?: boolean }) {
  const { armed, arm, open } = useContext(TapContext);
  const { read } = useReader();
  const key = word.toLowerCase();
  const isArmed = armed === key;
  return (
    <button type="button" data-nosay className={`wx-chip wx-tapword${isArmed ? ' armed' : ''}${bold ? ' bold' : ''} ${className}`}
      aria-label={isArmed ? `${word}. Tap again to open its word page.` : `${word}. Tap to hear it, tap twice to open it.`}
      onClick={() => {
        if (isArmed) { arm(null); open(key); return; }
        read(`tap:${key}`, word);
        arm(key);
      }}>
      {pos && <PosSymbol pos={pos} size={22} decorative />}
      <span>{word}</span>
      {isArmed && <span className="wx-tap-hint" aria-hidden="true">Tap again to open</span>}
    </button>
  );
}

// ---------- part of speech: her symbol shape plus its name, never color alone ----------
export function PosSymbol({ pos, size = 32, decorative = false }: { pos: PartOfSpeech; size?: number; decorative?: boolean }) {
  const info = GRAMMAR_SYMBOL_INFO[pos];
  return <img className="wx-pos-img" src={info.imageUrl} width={size} height={size} alt={decorative ? '' : info.name} />;
}
export function PosTag({ pos }: { pos: PartOfSpeech }) {
  return <span className="wx-pos"><PosSymbol pos={pos} decorative /><span>{pos}</span></span>;
}

export function StatusTag({ status }: { status: ReviewStatus }) {
  return <span className={`wx-status wx-status-${status}`}>{status === 'draft' ? 'Draft' : status === 'reviewed' ? 'Reviewed' : 'Approved'}</span>;
}

export const BAND_NAMES = ['', 'Very common', 'Common', 'Less common', 'Not common', 'Rare'];
