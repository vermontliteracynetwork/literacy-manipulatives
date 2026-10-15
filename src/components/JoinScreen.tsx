import { useState } from 'react';
import { shareConfigured } from '../lib/share';

// The student side of Share (her picture: Blooket's "Join a Game"): one big code box and an arrow, then a
// name box. Big, simple, nothing else on screen.
export function JoinScreen({ status, error, onCheckCode, onJoin }: {
  status: string; error?: string | null; onCheckCode: (code: string) => Promise<boolean>; onJoin: (name: string) => void;
}) {
  const [code, setCode] = useState('');
  const [codeOk, setCodeOk] = useState(false);
  const [name, setName] = useState('');
  const submitCode = async () => {
    if (code.length !== 4) return;
    setCodeOk(await onCheckCode(code));
  };
  return (
    <div className="lm-join">
      <a className="lm-join-back" href="/" aria-label="Back to the welcome screen">←</a>
      <div className="lm-join-center">
        <h1 className="lm-join-title">Join a Board</h1>
        {!shareConfigured ? (
          <p className="lm-join-msg">Joining isn't set up yet. Ask your teacher.</p>
        ) : !codeOk ? (
          <form className="lm-join-row" onSubmit={(e) => { e.preventDefault(); void submitCode(); }}>
            <input
              className="lm-join-input"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              placeholder="Code"
              aria-label="Code"
              value={code}
              autoFocus
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
            <button type="submit" className="lm-join-go" disabled={code.length !== 4 || status === 'checking'} aria-label="Next">
              {status === 'checking' ? '...' : '→'}
            </button>
          </form>
        ) : (
          <form className="lm-join-row" onSubmit={(e) => { e.preventDefault(); if (name.trim()) onJoin(name.trim().slice(0, 24)); }}>
            <input className="lm-join-input" placeholder="Your name" aria-label="Your name" value={name} maxLength={24} autoFocus onChange={(e) => setName(e.target.value)} />
            <button type="submit" className="lm-join-go" disabled={!name.trim()} aria-label="Join">→</button>
          </form>
        )}
        {status === 'not-found' && !codeOk && <p className="lm-join-msg">No board with that code right now. Check the code with your teacher.</p>}
        {status === 'error' && <p className="lm-join-msg">{error ?? "Couldn't connect. Check the internet and try again."}</p>}
      </div>
    </div>
  );
}
