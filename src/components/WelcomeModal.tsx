import { useEffect, useRef } from 'react';
import type { TTSSettings } from '../types';
import { HighlightedText, SyncedSpeakButton, type SyncedTTS } from './SyncedSpeakButton';

// Welcome pop-up shown when the board opens (direct teacher instruction,
// from the reference screenshots: "I like this loading screen pop up. I
// like how it is easy to understand and immediately indicates what can
// be done."). Deliberately not a tutorial or a lesson — the board stays
// open play. It says what the board is, the three things you do on it,
// and what's inside; every material chip jumps straight to that sidebar
// category. Closing it never touches the board underneath.

export interface WelcomeCategory {
  key: string;
  label: string;
  color: string;
}

export interface WelcomeGroup {
  title: string;
  categories: WelcomeCategory[];
}

const INTRO_ID = 'welcome-intro';
const INTRO_TEXT = 'This is your board. Drag anything from the left side onto the board, move it around, and build. There is no right or wrong here. Just explore!';

const STEPS = [
  { icon: '👈', title: 'Pick', text: 'Open a group on the left.' },
  { icon: '✋', title: 'Drag', text: 'Drag a tile onto the board.' },
  { icon: '🔈', title: 'Listen', text: 'Tap 🔈 to hear it read aloud.' },
];

export function WelcomeModal({ groups, showOnStart, onShowOnStartChange, onClose, onJumpToCategory, tts, settings }: {
  groups: WelcomeGroup[];
  showOnStart: boolean;
  onShowOnStartChange: (value: boolean) => void;
  onClose: () => void;
  onJumpToCategory: (key: string) => void;
  tts: SyncedTTS;
  settings: TTSSettings;
}) {
  const startRef = useRef<HTMLButtonElement>(null);

  // Focus the main button on open, close on Escape, stop any read-aloud
  // this pop-up started when it closes, and hand focus back to whatever
  // had it before.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    startRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  const ttsRef = useRef(tts);
  useEffect(() => { ttsRef.current = tts; });
  useEffect(() => () => { if (ttsRef.current.activeId === INTRO_ID) ttsRef.current.stop(); }, []);

  return (
    <div className="lm-welcome-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="lm-welcome" role="dialog" aria-modal="true" aria-labelledby="lm-welcome-title">
        <div className="lm-welcome-head">
          <h2 id="lm-welcome-title">👋 Welcome to Literacy Manipulatives!</h2>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Close welcome">✕</button>
        </div>

        <div className="lm-welcome-intro">
          <SyncedSpeakButton id={INTRO_ID} text={INTRO_TEXT} tts={tts} settings={settings} ariaLabel="Hear the welcome read aloud" />
          <p>
            <HighlightedText text={INTRO_TEXT} active={tts.activeId === INTRO_ID} wordIndex={tts.wordIndex} />
          </p>
        </div>

        <ol className="lm-welcome-steps">
          {STEPS.map((step, i) => (
            <li key={step.title} className="lm-welcome-step">
              <span className="lm-welcome-step-icon" aria-hidden="true">{step.icon}</span>
              <strong>{i + 1}. {step.title}</strong>
              <span>{step.text}</span>
            </li>
          ))}
        </ol>

        <h3 className="lm-welcome-subtitle">What's inside</h3>
        <div className="lm-welcome-groups">
          {groups.map((group) => (
            <section key={group.title} className="lm-welcome-group" aria-label={group.title}>
              <h4>{group.title}</h4>
              <div className="lm-welcome-chips">
                {group.categories.map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    className="lm-welcome-chip"
                    style={{ background: cat.color }}
                    onClick={() => onJumpToCategory(cat.key)}
                    title={`Open ${cat.label} on the left`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="lm-welcome-foot">
          <label className="lm-welcome-check">
            <input type="checkbox" checked={showOnStart} onChange={(e) => onShowOnStartChange(e.target.checked)} />
            Show this when the board opens
          </label>
          <button ref={startRef} type="button" className="btn btn-primary btn-lg" onClick={onClose}>Start exploring ✨</button>
        </div>
      </div>
    </div>
  );
}
