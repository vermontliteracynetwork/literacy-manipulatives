import { useRef, type ReactNode } from 'react';

// Every pop-up on the board (her request 2026-10-15: "always have an x. always allow pop ups to be moveable"):
// a small card with an ✕ that always shows, and a title bar you drag to move it. x/y are board coordinates,
// so the card zooms and scrolls with everything else; `zoom` turns screen pixels back into board pixels.
// Optional: `actions` sit in the title bar next to the X (a read-aloud button), `subtitle` is a line inside the
// colored bar under the title, and `tone` colors the bar (green for a real word, red for a nonsense one).
export function FloatingCard({ x, y, width = 260, zoom, title, onMove, onClose, children, actions, subtitle, tone, footer }: {
  x: number; y: number; width?: number; zoom: number; title: ReactNode;
  onMove: (x: number, y: number) => void; onClose: () => void; children: ReactNode;
  actions?: ReactNode; subtitle?: ReactNode; tone?: 'real' | 'nonsense'; footer?: ReactNode;
}) {
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  return (
    <div className={`lm-float${tone ? ` tone-${tone}` : ''}`} style={{ left: x, top: y, width }} role="dialog" aria-label={typeof title === 'string' ? title : 'Pop-up'}>
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
        <div className="lm-float-row">
          <span className="lm-float-grip" aria-hidden="true">⠿</span>
          <strong className="lm-float-title">{title}</strong>
          {actions && <span className="lm-float-actions" onPointerDown={(e) => e.stopPropagation()}>{actions}</span>}
          <button type="button" className="lm-float-x" onPointerDown={(e) => e.stopPropagation()} onClick={onClose} aria-label="Close">×</button>
        </div>
        {subtitle && <div className="lm-float-sub">{subtitle}</div>}
      </div>
      <div className="lm-float-body" onPointerDown={(e) => e.stopPropagation()}>{children}</div>
      {footer && <div className="lm-float-foot" onPointerDown={(e) => e.stopPropagation()}>{footer}</div>}
    </div>
  );
}
