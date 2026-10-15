import { KIND_COLOR, hasNotch, hasTab, pieceLabel, type Morpheme } from '../lib/morphemes';

// One jigsaw morpheme piece, drawn like her reference picture ("re- | sist | -ed"): a round knob on the right
// nests into the round notch on the left of the next piece. Pastel color by kind, black outline and text.
// A prefix is flat on the left and a suffix flat on the right, unless another prefix/suffix is snapped there,
// so the shape itself shows where a part can go.

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

// Width of the body (no knob). It always leaves room for a notch, so a piece keeps the same width when its
// shape changes, and the next piece in a word sits exactly this far to the right (its notch on this knob).
export function pieceBodyWidth(m: Morpheme): number {
  return Math.max(76, Math.ceil(textWidth(pieceLabel(m)) + 34 + KNOB_DEPTH));
}

export function pieceOuterSize(m: Morpheme, linkedRight = false): { w: number; h: number } {
  return { w: pieceBodyWidth(m) + (hasTab(m, linkedRight) ? KNOB_DEPTH : 0) + MARGIN * 2, h: PIECE_H + MARGIN * 2 };
}

export function MorphemePiece({ m, scale = 1, linkedLeft = false, linkedRight = false }: { m: Morpheme; scale?: number; linkedLeft?: boolean; linkedRight?: boolean }) {
  const W = pieceBodyWidth(m);
  const H = PIECE_H;
  const cy = H / 2;
  const r = 10;
  const tab = hasTab(m, linkedRight);
  const notch = hasNotch(m, linkedLeft);
  const right = tab
    ? `L ${W} ${cy - NECK} L ${W + NECK_LEN} ${cy - NECK} A ${KNOB_R} ${KNOB_R} 0 1 1 ${W + NECK_LEN} ${cy + NECK} L ${W} ${cy + NECK}`
    : '';
  const left = notch
    ? `L 0 ${cy + NECK} L ${NECK_LEN} ${cy + NECK} A ${KNOB_R} ${KNOB_R} 0 1 0 ${NECK_LEN} ${cy - NECK} L 0 ${cy - NECK}`
    : '';
  const d = `M ${r} 0 L ${W - r} 0 Q ${W} 0 ${W} ${r} ${right} L ${W} ${H - r} Q ${W} ${H} ${W - r} ${H} L ${r} ${H} Q 0 ${H} 0 ${H - r} ${left} L 0 ${r} Q 0 0 ${r} 0 Z`;
  const { w, h } = pieceOuterSize(m, linkedRight);
  const textX = (W + KNOB_DEPTH) / 2;
  return (
    <svg width={w * scale} height={h * scale} viewBox={`${-MARGIN} ${-MARGIN} ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
      <path d={d} fill={KIND_COLOR[m.kind]} stroke="#000000" strokeWidth="3" strokeLinejoin="round" />
      <text x={textX} y={cy + 8} textAnchor="middle" fontFamily="'Baloo 2', sans-serif" fontWeight={800} fontSize="22" fill="#000000">
        {pieceLabel(m)}
      </text>
    </svg>
  );
}
