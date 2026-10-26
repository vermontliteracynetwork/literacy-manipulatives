import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { TTSSettings } from '../types';
import { SyncedSpeakButton, type SyncedTTS } from './SyncedSpeakButton';

// One shared "here's a small reference fact about this thing" component,
// ported as-is from the dashboard's components/ReferencePopover.tsx -
// a hover tooltip (Grammar Symbols, Symbol Sentence previews) and an
// always-visible inline card (Morpheme definitions) sharing one layout.
export function ReferencePopover({ mode, title, body, children, speakId, speakText, tts, settings, style }: {
  mode: 'hover' | 'inline';
  title?: string;
  body: ReactNode;
  children?: ReactNode;
  speakId?: string;
  speakText?: string;
  tts?: SyncedTTS;
  settings?: TTSSettings;
  style?: CSSProperties;
}) {
  if (mode === 'hover') return <HoverTip title={title} body={body}>{children}</HoverTip>;
  return (
    <div className="chrome-frame lm-ref-popover" style={style}>
      <div className="space-between" style={{ alignItems: 'center', marginBottom: title ? 2 : 0 }}>
        {title && <div style={{ fontWeight: 800 }}>{title}</div>}
        {speakText && tts && speakId && (
          <SyncedSpeakButton
            id={speakId}
            text={speakText}
            tts={tts}
            settings={settings}
            ariaLabel={title ? `Hear ${title}` : 'Hear this'}
            style={{ padding: '2px 8px', minHeight: 24 }}
          />
        )}
      </div>
      <div>{body}</div>
    </div>
  );
}

// The hover tip is drawn on the page itself, not inside the panel it came from, so the side panel's edge never
// cuts it off (teacher, 2026-10-20: "make sure the description text is always show, never cut off (on symbols)").
// It wraps to fit, slides back inside the screen, and flips below the symbol when there is no room above.
// Mouse hover, keyboard focus, or a touch press on the iPad shows it.
function HoverTip({ title, body, children }: { title?: string; body: ReactNode; children?: ReactNode }) {
  const wrap = useRef<HTMLDivElement | null>(null);
  const tip = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const touchTimer = useRef<number | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const place = () => {
      const a = wrap.current?.getBoundingClientRect(), t = tip.current?.getBoundingClientRect();
      if (!a || !t) return;
      const pad = 10;
      const left = Math.min(Math.max(pad, a.left + a.width / 2 - t.width / 2), window.innerWidth - t.width - pad);
      const above = a.top - t.height - 6;
      setPos({ left, top: above >= pad ? above : Math.min(a.bottom + 6, window.innerHeight - t.height - pad) });
    };
    place();
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open]);
  return (
    <div ref={wrap} className="lm-symbol-tip-wrap" tabIndex={-1}
      onPointerEnter={(e) => {
        setOpen(true);
        // A tap on a touch screen keeps the tip up for a few seconds, so it can be read after the finger lifts.
        if (e.pointerType === 'touch') { if (touchTimer.current) window.clearTimeout(touchTimer.current); touchTimer.current = window.setTimeout(() => setOpen(false), 3500); }
      }}
      onPointerLeave={(e) => { if (e.pointerType !== 'touch') setOpen(false); }}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
      {children}
      {open && createPortal(
        <div ref={tip} className="lm-symbol-tip lm-symbol-tip-float" role="tooltip" style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}>
          {title && <strong>{title}</strong>}
          {body}
        </div>,
        document.body,
      )}
    </div>
  );
}
