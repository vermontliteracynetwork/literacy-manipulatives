import { useLayoutEffect, useRef, useState } from 'react';

// Every lesson screen fits without scrolling (her request 2026-11-18: "ALWAYS format so no scroll is required", "the
// middle part should always be presentation size"). `slide` draws a 16:9 presentation slide (1024 by 576) scaled to the
// space it has, exactly as students see it when the teacher presents. Without `slide`, it uses the space as it is (a
// student's iPad). Either way, content taller than the space shrinks to fit instead of scrolling.
export function Fit({ slide = false, className = '', children }: { slide?: boolean; className?: string; children: React.ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [m, setM] = useState({ s: 1, k: 1, W: 1024, H: 576 });
  useLayoutEffect(() => {
    const o = outer.current, i = inner.current;
    if (!o || !i) return;
    const measure = () => {
      const W = o.clientWidth, H = o.clientHeight;
      if (!W || !H) return;
      const dw = slide ? 1024 : W, dh = slide ? 576 : H;
      const s = slide ? Math.min(W / 1024, H / 576) : 1;
      const k = Math.min(1, dh / Math.max(1, i.scrollHeight));
      setM((p) => (Math.abs(p.s - s) < 0.001 && Math.abs(p.k - k) < 0.001 && p.W === dw && p.H === dh ? p : { s, k, W: dw, H: dh }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(o); ro.observe(i);
    const mo = new MutationObserver(measure);
    mo.observe(i, { childList: true, subtree: true, characterData: true });
    return () => { ro.disconnect(); mo.disconnect(); };
  }, [slide]);
  const scale = m.s * m.k;
  return (
    <div ref={outer} className={`ln-fit${slide ? ' ln-fit-slide' : ''} ${className}`}>
      <div className="ln-fit-frame" style={{ width: m.W * m.s, height: m.H * m.s }}>
        <div ref={inner} className="ln-fit-inner" style={{ width: m.W, transform: `translateX(${((m.W - m.W * m.k) / 2) * m.s}px) scale(${scale})` }}>
          {children}
        </div>
      </div>
    </div>
  );
}
