import { hasNotch, hasTab, pieceLabel, type Morpheme } from '../lib/morphemes';

// One jigsaw morpheme piece, drawn like her reference picture ("re- | sist | -ed"): white, black outline, a
// round knob on the right that nests into the round notch on the left of the next piece. A prefix has a flat
// left edge, a word-ending suffix a flat right edge, so the shape itself shows where a part can go.

export const PIECE_H = 64;
const MARGIN = 3; // room for the outline stroke on every side
const NECK = 6; // half the knob's neck height
const NECK_LEN = 4;
const KNOB_R = 11;
// How far the knob sticks out past the body (and how deep a notch cuts in).
export const KNOB_DEPTH = NECK_LEN + Math.sqrt(KNOB_R * KNOB_R - NECK * NECK) + KNOB_R;

let measureCtx: CanvasRenderingContext2D | null = null;
function textWidth(text: string): number {
  if (typeof document === 'undefined') return text.length * 12;
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * 12;
  measureCtx.font = "800 22px 'Baloo 2', sans-serif";
  return measureCtx.measureText(text).width;
}

// Width of the body (no knob). The next piece in a word sits exactly this far to the right, so its notch
// lands on this piece's knob.
export function pieceBodyWidth(m: Morpheme): number {
  return Math.max(76, Math.ceil(textWidth(pieceLabel(m)) + 34 + (hasNotch(m) ? KNOB_DEPTH : 0)));
}

export function pieceOuterSize(m: Morpheme): { w: number; h: number } {
  return { w: pieceBodyWidth(m) + (hasTab(m) ? KNOB_DEPTH : 0) + MARGIN * 2, h: PIECE_H + MARGIN * 2 };
}

export function MorphemePiece({ m, scale = 1 }: { m: Morpheme; scale?: number }) {
  const W = pieceBodyWidth(m);
  const H = PIECE_H;
  const cy = H / 2;
  const r = 10;
  const tab = hasTab(m);
  const notch = hasNotch(m);
  const right = tab
    ? `L ${W} ${cy - NECK} L ${W + NECK_LEN} ${cy - NECK} A ${KNOB_R} ${KNOB_R} 0 1 1 ${W + NECK_LEN} ${cy + NECK} L ${W} ${cy + NECK}`
    : '';
  const left = notch
    ? `L 0 ${cy + NECK} L ${NECK_LEN} ${cy + NECK} A ${KNOB_R} ${KNOB_R} 0 1 0 ${NECK_LEN} ${cy - NECK} L 0 ${cy - NECK}`
    : '';
  const d = `M ${r} 0 L ${W - r} 0 Q ${W} 0 ${W} ${r} ${right} L ${W} ${H - r} Q ${W} ${H} ${W - r} ${H} L ${r} ${H} Q 0 ${H} 0 ${H - r} ${left} L 0 ${r} Q 0 0 ${r} 0 Z`;
  const { w, h } = pieceOuterSize(m);
  const textX = notch ? (W + KNOB_DEPTH) / 2 : W / 2;
  return (
    <svg width={w * scale} height={h * scale} viewBox={`${-MARGIN} ${-MARGIN} ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
      <path d={d} fill="#ffffff" stroke="#000000" strokeWidth="3" strokeLinejoin="round" />
      <text x={textX} y={cy + 8} textAnchor="middle" fontFamily="'Baloo 2', sans-serif" fontWeight={800} fontSize="22" fill="#000000">
        {pieceLabel(m)}
      </text>
    </svg>
  );
}
