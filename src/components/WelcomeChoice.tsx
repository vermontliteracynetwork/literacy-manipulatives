import { useEffect, useRef } from 'react';

// The welcome pop-up on a first visit (her request 2026-10-15): start your own whiteboard, or join a
// teacher's board with a code (the same page as literacy-manipulatives.vercel.app/join).
export function WelcomeChoice({ onStart }: { onStart: () => void }) {
  const startRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { startRef.current?.focus(); }, []);
  return (
    <div className="lm-welcome-backdrop" role="dialog" aria-modal="true" aria-labelledby="lm-welcome-title">
      <div className="lm-welcome">
        <h2 id="lm-welcome-title">Welcome to Literacy Manipulatives</h2>
        <p>Build words, sentences and sounds by dragging pieces onto a whiteboard.</p>
        <div className="lm-welcome-choices">
          <button ref={startRef} type="button" className="lm-welcome-choice start" onClick={onStart}>
            <strong>Start a whiteboard</strong>
            <span>Open your own board</span>
          </button>
          <a className="lm-welcome-choice join" href="/join">
            <strong>Join a board</strong>
            <span>Type your teacher's code</span>
          </a>
        </div>
      </div>
    </div>
  );
}
