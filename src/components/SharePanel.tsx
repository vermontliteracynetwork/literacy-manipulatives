import { useState } from 'react';
import { FloatingCard } from './FloatingCard';
import { shareConfigured, type Access, type SharedStudent } from '../lib/share';

// The teacher's Share pop-up: the 4-digit code and join link to give students, then each student who joins
// (by the name they typed) with a view 👁 / edit ✏️ switch on the right. Movable, always has an ✕ (closing it
// keeps sharing on; "Stop sharing" ends it).
export function SharePanel({ code, status, students, access, onSetAccess, onStop, onClose }: {
  code: string | null; status: string; students: SharedStudent[]; access: Record<string, Access>;
  onSetAccess: (id: string, a: Access) => void; onStop: () => void; onClose: () => void;
}) {
  const [pos, setPos] = useState({ x: Math.max(16, window.innerWidth - 400), y: 80 });
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/join`;
  return (
    <div className="lm-fixed-layer">
      <FloatingCard x={pos.x} y={pos.y} width={360} zoom={1} title="🔗 Share this board" onMove={(x, y) => setPos({ x, y })} onClose={onClose}>
        {!shareConfigured ? (
          <p style={{ margin: 0 }}>
            Sharing isn't set up yet. It needs a Supabase project: add its URL and public anon key to this site's Vercel
            settings as <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then redeploy.
          </p>
        ) : status === 'starting' ? (
          <p style={{ margin: 0 }}>Making a code…</p>
        ) : status === 'error' || !code ? (
          <p style={{ margin: 0 }}>Couldn't start sharing. Check the internet connection and try Share again.</p>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, opacity: 0.7 }}>Students go to</div>
              <div style={{ fontWeight: 800, wordBreak: 'break-all' }}>{link.replace(/^https?:\/\//, '')}</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, opacity: 0.7, marginTop: 6 }}>and type this code</div>
              <div className="lm-share-code" aria-label={`Code ${code.split('').join(' ')}`}>{code}</div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => { void navigator.clipboard?.writeText(`${link}  Code: ${code}`).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); }); }}
              >
                {copied ? '✅ Copied' : '📋 Copy link and code'}
              </button>
            </div>
            <div>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>Students ({students.length})</div>
              {students.length === 0 ? (
                <p style={{ margin: 0, opacity: 0.6, fontSize: '0.85rem' }}>Waiting for students to join…</p>
              ) : (
                <ul className="lm-share-list">
                  {students.map((st) => {
                    const a = access[st.id] ?? 'view';
                    return (
                      <li key={st.id}>
                        <span className="lm-share-name">{st.name}</span>
                        <span className="lm-share-toggle" role="radiogroup" aria-label={`${st.name}'s access`}>
                          <button type="button" role="radio" aria-checked={a === 'view'} className={a === 'view' ? 'on' : ''} onClick={() => onSetAccess(st.id, 'view')} title="Can only watch">👁️</button>
                          <button type="button" role="radio" aria-checked={a === 'edit'} className={a === 'edit' ? 'on' : ''} onClick={() => onSetAccess(st.id, 'edit')} title="Can move pieces">✏️</button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <button type="button" className="btn btn-sm" onClick={onStop}>⏹️ Stop sharing</button>
          </div>
        )}
      </FloatingCard>
    </div>
  );
}
