import { useRef, type ReactNode } from 'react';

// Every pop-up on the board (her request 2026-10-15: "always have an x. always allow pop ups to be moveable"):
// a small card with an ✕ that always shows, and a title bar you drag to move it. x/y are board coordinates,
// so the card zooms and scrolls with everything else; `zoom` turns screen pixels back into board pixels.
export function FloatingCard({ x, y, width = 260, zoom, title, onMove, onClose, children }: {
  x: number; y: number; width?: number; zoom: number; title: ReactNode;
  onMove: (x: number, y: number) => void; onClose: () => void; children: ReactNode;
}) {
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  return (
    <div className="lm-float" style={{ left: x, top: y, width }} role="dialog" aria-label={typeof title === 'string' ? title : 'Pop-up'}>
      <div
        className="lm-float-bar"
        onPointerDown={(e) => {
          e.stopPropagation();
          drag.current = { px: e.clientX, py: e.clientY, x, y };
          try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* window keeps tracking */ }
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          onMove(d.x + (e.clientX - d.px) / zoom, d.y + (e.clientY - d.py) / zoom);
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
      >
        <span className="lm-float-grip" aria-hidden="true">⠿</span>
        <strong className="lm-float-title">{title}</strong>
        <button type="button" className="lm-float-x" onPointerDown={(e) => e.stopPropagation()} onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="lm-float-body" onPointerDown={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}
