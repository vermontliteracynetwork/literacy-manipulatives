// Story Maker video: a small pixel stage (144 x 128) drawn fresh for every frame from the sentence, then scaled up
// for the screen and for the saved video. Every frame is worked out from the clock alone, so the preview, the Play
// button and the saved video always match.
import type { ActorSpec, Analysis, GroupModel, StoryContext, Word } from './grammar';
import { LIVING, PEOPLE, ROUND, verbById, type LookId, type PrepId, type Tense, type VerbId } from './words';

export const SW = 144;
export const SH = 128;
export const HI = 5; // screen pixels per stage pixel
/** Extra stage on each side for the wide (16:9) screen video. The saved vertical video uses none. */
export const WIDE = 42;
type Ctx = CanvasRenderingContext2D;
let EX = 0;
const FW = () => SW + 2 * EX;

/* ---------------- Clips ---------------- */

export interface Clip { a: Analysis; place: string; duration: number; text: string; words: Word[] }

const WATER_PLACES = ['pond', 'beach', 'bridge'];

export function makeClip(a: Analysis, ctx: StoryContext): Clip {
  const wantsWater = a.groups.some((g) => g.verbs.includes('swim') || g.actors.some((x) => x.look === 'fish'));
  let place = a.place ?? ctx.place ?? 'meadow';
  if (wantsWater && !WATER_PLACES.includes(place)) place = 'pond';
  const g0 = a.groups[0];
  if (g0?.prep === 'in' && g0.place === 'house') place = 'room';
  let d = 6;
  if (a.groups.some((g) => g.object.length)) d += 1;
  if (a.groups.some((g) => g.prep)) d += 0.5;
  if (a.groups.length > 1) d += 1;
  if (a.intj) d += 0.8;
  d += Math.max(0, a.words.length - 8) * 0.25;
  return { a, place, duration: Math.min(10, Math.max(5, d)), text: a.text, words: a.words.filter((w) => w.text) };
}

/** Which word is being read at time t (for captions and highlights). */
export function wordAt(t: number, n: number): number {
  const i = Math.floor((t - 0.35) / 0.42);
  return i >= 0 && i < n ? i : -1;
}

/* ---------------- Places ---------------- */

interface Geo { ground: number; lx: number; water?: { x0: number; x1: number; y: number; swim: number } }
const GEO: Record<string, Geo> = {
  meadow: { ground: 104, lx: 100 },
  park: { ground: 104, lx: 100 },
  pond: { ground: 104, lx: 102, water: { x0: 66, x1: 140, y: 104, swim: 113 } },
  beach: { ground: 106, lx: 100, water: { x0: 98, x1: 144, y: 100, swim: 113 } },
  forest: { ground: 104, lx: 104 },
  house: { ground: 104, lx: 105 },
  room: { ground: 108, lx: 100 },
  hill: { ground: 104, lx: 100 },
  tree: { ground: 104, lx: 104 },
  bridge: { ground: 104, lx: 100, water: { x0: 74, x1: 126, y: 106, swim: 115 } },
  farm: { ground: 104, lx: 110 },
  garden: { ground: 104, lx: 100 },
  school: { ground: 104, lx: 108 },
  cave: { ground: 104, lx: 107 },
};
const geo = (p: string) => GEO[p] ?? GEO.meadow;

/** Height of the ground at x (the hill is a hump; the bridge deck is for walkers on it). */
function terrain(place: string, x: number, onDeck = false): number {
  const g = geo(place);
  if (place === 'hill') {
    const d = (x - g.lx) / 46;
    if (Math.abs(d) < 1) return Math.round(72 + d * d * 32);
  }
  if (place === 'bridge' && onDeck && x > 58 && x < 142) {
    const d = (x - 100) / 42;
    return Math.round(88 - (1 - d * d) * 6);
  }
  return g.ground;
}

interface Spot { x: number; y: number; behind?: boolean; deck?: boolean }
function spot(place: string, prep: PrepId | undefined): Spot {
  const g = geo(place);
  switch (prep) {
    case 'on':
      if (place === 'hill') return { x: g.lx, y: terrain(place, g.lx) };
      if (place === 'house') return { x: 107, y: 57 };
      if (place === 'bridge') return { x: 100, y: terrain(place, 100, true), deck: true };
      return { x: 52, y: g.ground };
    case 'under':
      if (place === 'bridge') return { x: 100, y: 114 };
      return { x: g.lx - 2, y: g.ground };
    case 'near': return { x: g.lx - (place === 'pond' ? 44 : 30), y: g.ground };
    case 'behind': return { x: place === 'house' || place === 'school' ? 116 : g.lx + 2, y: place === 'hill' ? 96 : g.ground, behind: true };
    case 'in':
      if (place === 'pond') return { x: 100, y: 113 };
      if (place === 'cave') return { x: 107, y: g.ground };
      if (place === 'garden') return { x: 96, y: g.ground };
      return { x: 72, y: g.ground };
    default: return { x: 72, y: g.ground };
  }
}

/* ---------------- Colors ---------------- */

const COLOR: Record<string, string> = {
  red: '#e53935', blue: '#1e88e5', green: '#43a047', pink: '#f06292', purple: '#8e24aa', yellow: '#fdd835',
  orange: '#fb8c00', white: '#f4f4f4', black: '#37474f', brown: '#8d6e63',
};
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s: number) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/* ---------------- Pixel helpers ---------------- */

function R(c: Ctx, x: number, y: number, w: number, h: number, col: string) {
  c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
function pattern(c: Ctx, x: number, y: number, rows: string[], col: string) {
  c.fillStyle = col;
  rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === 'X') c.fillRect(Math.round(x) + i, Math.round(y) + j, 1, 1); });
}
const HEART = ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'];
const NOTE = ['..XX', '..X.', '..X.', 'XXX.', 'XX..'];
const ZED = ['XXX', '..X', '.X.', 'XXX'];
const PLUS = ['.X.', 'XXX', '.X.'];
const BIGPLUS = ['..X..', '..X..', 'XXXXX', '..X..', '..X..'];
const HAND = ['X.X.X', 'XXXXX', 'XXXXX', '.XXX.'];

/* ---------------- Looks (drawn into a 40 x 32 sprite, feet on row 31, facing right) ---------------- */

interface Pose { moving: boolean; phase: number; eyesClosed?: boolean; mouthOpen?: boolean; wingsUp?: boolean; mood?: 'happy' | 'sad' | 'none'; fins?: boolean }
interface Pal { main: string; dark: string; light: string }

const BASE_PAL: Record<LookId, Pal> = {
  dog: { main: '#a66a3a', dark: '#6e4424', light: '#e3b27f' },
  cat: { main: '#8c8f9e', dark: '#5d6070', light: '#d6d8e0' },
  bird: { main: '#4aa8e0', dark: '#2a6f9e', light: '#e8f4fb' },
  frog: { main: '#55b04a', dark: '#337a2c', light: '#c9e88f' },
  fish: { main: '#f28b30', dark: '#c25e12', light: '#ffe0b2' },
  rabbit: { main: '#ece6dc', dark: '#b9b0a3', light: '#f5a9b8' },
  turtle: { main: '#3f8f4a', dark: '#2c6b35', light: '#9ccc65' },
  robot: { main: '#9aa5b1', dark: '#5e6a77', light: '#cfd8e0' },
  girl: { main: '#e85a8a', dark: '#b03a66', light: '#f1c8a5' },
  boy: { main: '#3f7fd6', dark: '#2f3f5f', light: '#c68c5a' },
  me: { main: '#43a047', dark: '#37474f', light: '#e8b48a' },
  you: { main: '#f2b134', dark: '#4e342e', light: '#8d5a3b' },
  ball: { main: '#e53935', dark: '#a52a28', light: '#ffffff' },
  apple: { main: '#e53935', dark: '#a52a28', light: '#ff8a80' },
  cake: { main: '#f8bbd0', dark: '#d48aa6', light: '#ffffff' },
  box: { main: '#c48a4a', dark: '#8d5f2e', light: '#e8c088' },
  book: { main: '#3949ab', dark: '#283593', light: '#ffffff' },
  flower: { main: '#f06292', dark: '#c2185b', light: '#ffd54f' },
  pig: { main: '#f4a6b8', dark: '#d97a92', light: '#fbd0db' },
  cow: { main: '#f5f5f5', dark: '#3a3a3a', light: '#f2b8c6' },
  horse: { main: '#8d5a33', dark: '#5a3720', light: '#e9d3b5' },
  duck: { main: '#fdd835', dark: '#f9a825', light: '#ff8f00' },
  mouse: { main: '#9e9e9e', dark: '#616161', light: '#f8bbd0' },
  bear: { main: '#795548', dark: '#4e342e', light: '#d7ccc8' },
  lion: { main: '#f4b400', dark: '#b26a00', light: '#ffe082' },
  owl: { main: '#8d6e63', dark: '#5d4037', light: '#ffe0b2' },
  monkey: { main: '#a1683a', dark: '#6d4422', light: '#f1c8a5' },
  snake: { main: '#7cb342', dark: '#558b2f', light: '#dcedc8' },
  man: { main: '#00897b', dark: '#37474f', light: '#d9a57a' },
  woman: { main: '#7e57c2', dark: '#4a2c82', light: '#a86b4a' },
  baby: { main: '#81d4fa', dark: '#4fa3d1', light: '#f1c8a5' },
  banana: { main: '#fdd835', dark: '#c6a700', light: '#fff59d' },
  cookie: { main: '#c68642', dark: '#5d4037', light: '#e0a868' },
  pizza: { main: '#ffca28', dark: '#d4943a', light: '#d32f2f' },
  carrot: { main: '#fb8c00', dark: '#c25e00', light: '#43a047' },
  egg: { main: '#fff8e1', dark: '#d7ccc8', light: '#ffffff' },
  car: { main: '#1e88e5', dark: '#1565c0', light: '#bbdefb' },
  kite: { main: '#e53935', dark: '#1e88e5', light: '#ffffff' },
  hat: { main: '#263238', dark: '#000000', light: '#e53935' },
  drum: { main: '#e53935', dark: '#a52a28', light: '#fff8e1' },
  rock: { main: '#9e9e9e', dark: '#6d6d6d', light: '#cfcfcf' },
};
const K = '#1d1d27';

function face(c: Ctx, x: number, y: number, p: Pose, gap = 4) {
  if (p.eyesClosed) { R(c, x, y + 1, 2, 1, K); R(c, x + gap, y + 1, 2, 1, K); }
  else { R(c, x, y, 1, 2, K); R(c, x + gap, y, 1, 2, K); }
}
function mouth(c: Ctx, x: number, y: number, p: Pose, w = 3) {
  if (p.mouthOpen) { R(c, x, y, w, 2, '#7a1f2b'); return; }
  if (p.mood === 'sad') { R(c, x + 1, y, w - 2, 1, K); R(c, x, y + 1, 1, 1, K); R(c, x + w - 1, y + 1, 1, 1, K); return; }
  if (p.mood === 'happy') { R(c, x, y, 1, 1, K); R(c, x + w - 1, y, 1, 1, K); R(c, x + 1, y + 1, w - 2, 1, K); return; }
  R(c, x, y, w, 1, K);
}

function drawLook(c: Ctx, look: LookId, pal: Pal, p: Pose) {
  const a = p.moving ? Math.round(Math.sin(p.phase * Math.PI * 2) * 2) : 0;
  const { main, dark, light } = pal;
  switch (look) {
    case 'dog': {
      R(c, 6, 15 + (p.phase % 0.5 < 0.25 ? -1 : 0), 4, 2, main);
      R(c, 9, 18, 17, 8, main); R(c, 9, 25, 17, 1, dark);
      R(c, 11 + a, 26, 2, 5, dark); R(c, 14 - a, 26, 2, 5, main); R(c, 21 + a, 26, 2, 5, dark); R(c, 24 - a, 26, 2, 5, main);
      R(c, 23, 11, 10, 9, main); R(c, 23, 10, 3, 8, dark);
      R(c, 31, 15, 5, 4, light); R(c, 35, 15, 1, 2, K);
      face(c, 28, 13, p, 0); mouth(c, 31, 19, p, 3);
      break;
    }
    case 'cat': {
      R(c, 7, 11, 2, 9, main); R(c, 8, 10, 2, 2, main);
      R(c, 10, 19, 15, 7, main); R(c, 10, 25, 15, 1, dark);
      R(c, 12 + a, 26, 2, 5, dark); R(c, 15 - a, 26, 2, 5, main); R(c, 20 + a, 26, 2, 5, dark); R(c, 23 - a, 26, 2, 5, main);
      R(c, 23, 12, 10, 9, main); R(c, 23, 10, 2, 2, main); R(c, 31, 10, 2, 2, main); R(c, 24, 11, 1, 1, '#f2a0b5'); R(c, 31, 11, 1, 1, '#f2a0b5');
      face(c, 26, 14, p, 4); R(c, 28, 17, 1, 1, '#f2a0b5'); mouth(c, 27, 18, p, 3);
      R(c, 33, 17, 3, 1, light); R(c, 20, 17, 3, 1, light);
      break;
    }
    case 'bird': {
      R(c, 9, 19, 5, 3, dark);
      R(c, 13, 17, 13, 9, main); R(c, 14, 16, 11, 1, main); R(c, 14, 26, 11, 1, main); R(c, 17, 21, 8, 4, light);
      R(c, 22, 10, 9, 8, main); face(c, 27, 12, p, 0); R(c, 31, 14, 3, 2, '#f2a33a');
      if (p.mouthOpen) R(c, 31, 16, 3, 1, '#f2a33a');
      if (p.wingsUp) R(c, 13, 10, 9, 6, dark); else R(c, 13, 19, 9, 4, dark);
      if (!p.wingsUp || !p.moving) { R(c, 17 + a, 27, 1, 4, '#f2a33a'); R(c, 21 - a, 27, 1, 4, '#f2a33a'); }
      break;
    }
    case 'frog': {
      R(c, 11, 19, 18, 9, main); R(c, 14, 23, 12, 5, light);
      R(c, 12, 15, 6, 6, main); R(c, 22, 15, 6, 6, main);
      R(c, 13, 16, 4, 4, '#fff'); R(c, 23, 16, 4, 4, '#fff');
      if (p.eyesClosed) { R(c, 13, 18, 4, 1, K); R(c, 23, 18, 4, 1, K); } else { R(c, 15, 17, 2, 2, K); R(c, 25, 17, 2, 2, K); }
      mouth(c, 16, 22, p, 8);
      if (p.moving) { R(c, 6, 24, 7, 3, dark); R(c, 27, 26, 5, 2, dark); } else { R(c, 8, 26, 5, 5, dark); R(c, 26, 27, 4, 4, dark); }
      break;
    }
    case 'fish': {
      const w = Math.round(Math.sin(p.phase * Math.PI * 2) * 1);
      R(c, 7, 15 + w, 4, 12, dark); R(c, 10, 18, 3, 6, dark);
      R(c, 12, 16, 18, 10, main); R(c, 13, 15, 16, 1, main); R(c, 13, 26, 16, 1, main);
      R(c, 18, 16, 2, 10, light); R(c, 17, 13, 7, 2, dark);
      R(c, 25, 18, 3, 3, '#fff'); if (p.eyesClosed) R(c, 25, 19, 3, 1, K); else R(c, 26, 19, 1, 2, K);
      mouth(c, 28, 23, p, 2);
      break;
    }
    case 'rabbit': {
      R(c, 9, 19, 3, 3, '#ffffff');
      R(c, 11, 19, 14, 8, main); R(c, 11, 26, 14, 1, dark);
      R(c, 12 + a, 27, 6, 4, main); R(c, 21 - a, 27, 4, 4, main);
      R(c, 22, 12, 9, 9, main);
      R(c, 23, 2, 3, 11, main); R(c, 27, 3, 3, 10, main); R(c, 24, 4, 1, 7, light); R(c, 28, 5, 1, 6, light);
      face(c, 27, 15, p, 0); R(c, 30, 17, 1, 1, light); mouth(c, 28, 19, p, 2);
      break;
    }
    case 'turtle': {
      R(c, 8, 23, 3, 2, light);
      R(c, 11, 26 + (a > 0 ? 0 : 1), 3, 5, light); R(c, 23, 26 + (a > 0 ? 1 : 0), 3, 5, light);
      R(c, 26, 17, 7, 6, light); face(c, 30, 18, p, 0); mouth(c, 30, 21, p, 2);
      R(c, 11, 15, 16, 9, main); R(c, 13, 13, 12, 2, main); R(c, 10, 23, 18, 3, dark);
      R(c, 14, 16, 3, 3, dark); R(c, 20, 16, 3, 3, dark); R(c, 17, 19, 3, 3, dark);
      break;
    }
    case 'robot': {
      R(c, 15, 24, 3, 7 - Math.max(0, a), dark); R(c, 21, 24, 3, 7 - Math.max(0, -a), dark);
      R(c, 12, 13, 15, 11, main); R(c, 15, 16, 9, 5, light); R(c, 18, 18, 3, 1, p.phase % 1 < 0.5 ? '#4fd1ff' : '#ff5252');
      R(c, 9, 14 + a, 3, 8, dark); R(c, 27, 14 - a, 3, 8, dark);
      R(c, 14, 4, 11, 8, main); R(c, 19, 1, 1, 3, dark); R(c, 18, 0, 3, 1, '#ff5252');
      if (p.eyesClosed) { R(c, 16, 8, 3, 1, K); R(c, 21, 8, 3, 1, K); } else { R(c, 16, 7, 3, 2, '#4fd1ff'); R(c, 21, 7, 3, 2, '#4fd1ff'); }
      if (p.mouthOpen) R(c, 18, 10, 4, 1, '#4fd1ff');
      break;
    }
    case 'girl': case 'boy': case 'me': case 'you': case 'man': case 'woman': {
      const skin = pal.light;
      const hair = look === 'girl' ? '#5b3a29' : look === 'boy' ? '#2b2018' : look === 'me' ? '#7a4a1f' : look === 'man' ? '#4e342e' : look === 'woman' ? '#212121' : '#1b1b1b';
      const pants = look === 'girl' || look === 'woman' ? skin : dark;
      R(c, 16, 23 + Math.max(0, a), 3, 8 - Math.max(0, a), pants); R(c, 21, 23 + Math.max(0, -a), 3, 8 - Math.max(0, -a), pants);
      R(c, 15, 30, 4, 1, '#333'); R(c, 21, 30, 4, 1, '#333');
      R(c, 15, 14, 10, 10, main);
      if (look === 'girl' || look === 'woman') R(c, 14, 21, 12, 3, main);
      R(c, 12, 15 - a, 3, 7, main); R(c, 25, 15 + a, 3, 7, main); R(c, 12, 22 - a, 3, 2, skin); R(c, 25, 22 + a, 3, 2, skin);
      R(c, 15, 4, 10, 10, skin);
      face(c, 17, 8, p, 5); mouth(c, 18, 11, p, 4);
      if (look === 'girl') { R(c, 14, 2, 12, 4, hair); R(c, 13, 4, 3, 10, hair); R(c, 24, 4, 3, 10, hair); R(c, 26, 5, 2, 6, hair); }
      else if (look === 'boy') { R(c, 14, 2, 12, 4, hair); R(c, 14, 6, 2, 3, hair); }
      else if (look === 'me') { R(c, 14, 3, 12, 3, hair); R(c, 14, 1, 12, 3, main); R(c, 24, 4, 5, 1, main); }
      else if (look === 'man') { R(c, 14, 2, 12, 4, hair); R(c, 14, 6, 2, 4, hair); R(c, 17, 10, 6, 1, hair); }
      else if (look === 'woman') { R(c, 14, 2, 12, 4, hair); R(c, 13, 4, 3, 8, hair); R(c, 24, 4, 3, 8, hair); R(c, 17, 0, 6, 3, hair); }
      else { R(c, 14, 1, 12, 5, hair); R(c, 13, 3, 3, 7, hair); R(c, 24, 3, 3, 7, hair); }
      break;
    }
    case 'ball':
      R(c, 17, 21, 6, 1, main); R(c, 16, 22, 8, 1, main); R(c, 15, 23, 10, 6, main); R(c, 16, 29, 8, 1, main); R(c, 17, 30, 6, 1, main);
      R(c, 15, 25, 10, 1, light); R(c, 17, 23, 2, 1, '#ffcdd2');
      break;
    case 'apple':
      R(c, 16, 22, 8, 1, main); R(c, 15, 23, 10, 7, main); R(c, 16, 30, 8, 1, main); R(c, 17, 24, 2, 2, light);
      R(c, 19, 19, 1, 3, '#6d4c41'); R(c, 20, 19, 3, 2, '#43a047');
      break;
    case 'cake':
      R(c, 12, 24, 16, 7, main); R(c, 12, 22, 16, 3, light); R(c, 13, 25, 1, 2, light); R(c, 18, 25, 1, 3, light); R(c, 24, 25, 1, 2, light);
      R(c, 19, 18, 2, 4, '#fff59d'); R(c, 19, 16, 2, 2, '#ff9800');
      break;
    case 'box':
      R(c, 12, 19, 16, 12, main); R(c, 12, 19, 16, 2, dark); R(c, 19, 19, 2, 12, light);
      break;
    case 'book':
      R(c, 12, 24, 16, 7, main); R(c, 13, 23, 14, 1, light); R(c, 12, 30, 16, 1, dark); R(c, 14, 26, 9, 1, light);
      break;
    case 'flower':
      R(c, 19, 22, 2, 9, '#43a047'); R(c, 21, 25, 3, 2, '#43a047'); R(c, 16, 25, 3, 2, '#43a047');
      R(c, 17, 14, 6, 2, main); R(c, 16, 16, 8, 4, main); R(c, 17, 20, 6, 2, main); R(c, 19, 17, 2, 2, light);
      break;
    // New looks (her request 2026-11-17: more words, each with its own pixel picture drawn here, nothing copied).
    case 'pig': {
      R(c, 6, 16, 2, 2, dark); R(c, 7, 15, 2, 1, dark);
      R(c, 8, 17, 19, 10, main); R(c, 8, 26, 19, 1, dark);
      R(c, 10 + a, 27, 3, 4, dark); R(c, 14 - a, 27, 3, 4, main); R(c, 20 + a, 27, 3, 4, dark); R(c, 24 - a, 27, 3, 4, main);
      R(c, 24, 13, 10, 10, main); R(c, 25, 11, 3, 3, dark); R(c, 31, 11, 3, 3, dark);
      R(c, 33, 17, 4, 4, light); R(c, 34, 18, 1, 1, dark); R(c, 36, 18, 1, 1, dark);
      face(c, 28, 15, p, 3); mouth(c, 29, 21, p, 3);
      break;
    }
    case 'cow': {
      R(c, 5, 15, 2, 8, dark);
      R(c, 7, 15, 21, 11, main); R(c, 11, 17, 5, 4, dark); R(c, 20, 20, 5, 4, dark); R(c, 14, 25, 4, 1, light);
      R(c, 9 + a, 26, 3, 5, main); R(c, 13 - a, 26, 3, 5, main); R(c, 21 + a, 26, 3, 5, main); R(c, 25 - a, 26, 3, 5, main);
      R(c, 9 + a, 30, 3, 1, dark); R(c, 13 - a, 30, 3, 1, dark); R(c, 21 + a, 30, 3, 1, dark); R(c, 25 - a, 30, 3, 1, dark);
      R(c, 26, 10, 9, 11, main); R(c, 24, 11, 3, 2, dark); R(c, 27, 8, 1, 2, '#e0c080'); R(c, 33, 8, 1, 2, '#e0c080');
      R(c, 31, 16, 6, 5, light); R(c, 33, 17, 1, 1, K); R(c, 35, 17, 1, 1, K);
      face(c, 29, 12, p, 3); mouth(c, 32, 20, p, 3);
      break;
    }
    case 'horse': {
      R(c, 4, 14, 4, 10, dark);
      R(c, 8, 14, 19, 10, main); R(c, 8, 23, 19, 1, dark);
      R(c, 10 + a, 24, 2, 7, dark); R(c, 13 - a, 24, 2, 7, main); R(c, 22 + a, 24, 2, 7, dark); R(c, 25 - a, 24, 2, 7, main);
      R(c, 24, 6, 6, 12, main); R(c, 26, 3, 11, 7, main); R(c, 22, 4, 3, 12, dark); R(c, 26, 1, 2, 3, main);
      R(c, 34, 6, 3, 4, light); face(c, 30, 5, p, 0); mouth(c, 34, 9, p, 2);
      break;
    }
    case 'duck': {
      R(c, 10, 18, 3, 3, main);
      R(c, 12, 19, 16, 9, main); R(c, 13, 28, 14, 1, dark);
      R(c, 23, 10, 9, 10, main); R(c, 32, 15, 5, 2, light); if (p.mouthOpen) R(c, 32, 17, 4, 1, light);
      face(c, 28, 13, p, 0);
      if (p.wingsUp) R(c, 14, 12, 9, 6, dark); else R(c, 15, 21, 9, 4, dark);
      R(c, 17 + a, 29, 2, 2, light); R(c, 22 - a, 29, 2, 2, light); R(c, 17 + a, 30, 4, 1, light); R(c, 22 - a, 30, 4, 1, light);
      break;
    }
    case 'mouse': {
      R(c, 5, 27, 9, 1, light); R(c, 4, 26, 2, 1, light);
      R(c, 13, 22, 13, 7, main); R(c, 14, 21, 10, 1, main);
      R(c, 15 + a, 29, 2, 2, dark); R(c, 22 - a, 29, 2, 2, dark);
      R(c, 24, 21, 8, 7, main); R(c, 32, 24, 2, 2, main); R(c, 33, 24, 1, 1, K);
      R(c, 23, 17, 4, 4, main); R(c, 24, 18, 2, 2, light); R(c, 27, 16, 4, 4, main); R(c, 28, 17, 2, 2, light);
      face(c, 28, 22, p, 0); mouth(c, 30, 26, p, 2);
      R(c, 33, 25, 3, 1, '#bdbdbd');
      break;
    }
    case 'bear': {
      R(c, 7, 12, 22, 14, main); R(c, 11, 15, 12, 9, light);
      R(c, 9 + a, 26, 4, 5, dark); R(c, 14 - a, 26, 4, 5, main); R(c, 21 + a, 26, 4, 5, dark); R(c, 25 - a, 26, 4, 5, main);
      R(c, 23, 5, 13, 11, main); R(c, 23, 3, 4, 4, main); R(c, 32, 3, 4, 4, main); R(c, 24, 4, 2, 2, dark); R(c, 33, 4, 2, 2, dark);
      R(c, 31, 10, 6, 5, light); R(c, 35, 10, 2, 2, K);
      face(c, 28, 8, p, 0); mouth(c, 32, 14, p, 3);
      break;
    }
    case 'lion': {
      R(c, 4, 13, 2, 3, dark); R(c, 5, 15, 4, 1, main);
      R(c, 8, 16, 18, 9, main); R(c, 8, 24, 18, 1, dark);
      R(c, 10 + a, 25, 2, 6, dark); R(c, 13 - a, 25, 2, 6, main); R(c, 20 + a, 25, 2, 6, dark); R(c, 23 - a, 25, 2, 6, main);
      R(c, 21, 5, 16, 17, dark); R(c, 20, 8, 1, 11, dark); R(c, 37, 8, 1, 11, dark);
      R(c, 24, 8, 11, 11, main); R(c, 30, 13, 5, 4, light); R(c, 32, 13, 2, 1, K);
      face(c, 27, 10, p, 4); mouth(c, 30, 17, p, 4);
      break;
    }
    case 'owl': {
      R(c, 13, 10, 3, 3, dark); R(c, 24, 10, 3, 3, dark);
      R(c, 13, 12, 14, 17, main); R(c, 16, 19, 8, 9, light);
      for (let k = 0; k < 3; k++) R(c, 17 + k * 2, 22 + (k % 2) * 2, 1, 1, dark);
      R(c, 14, 13, 5, 5, '#fff'); R(c, 21, 13, 5, 5, '#fff');
      if (p.eyesClosed) { R(c, 15, 15, 3, 1, K); R(c, 22, 15, 3, 1, K); } else { R(c, 16, 14, 2, 3, K); R(c, 23, 14, 2, 3, K); }
      R(c, 19, 18, 2, 2, '#ff8f00'); if (p.mouthOpen) R(c, 19, 20, 2, 1, '#7a1f2b');
      if (p.wingsUp) { R(c, 7, 9, 6, 8, dark); R(c, 27, 9, 6, 8, dark); } else { R(c, 11, 16, 2, 10, dark); R(c, 27, 16, 2, 10, dark); }
      R(c, 15, 29, 3, 2, '#ff8f00'); R(c, 22, 29, 3, 2, '#ff8f00');
      break;
    }
    case 'monkey': {
      R(c, 7, 13, 1, 6, main); R(c, 7, 18, 7, 1, main); R(c, 8, 12, 2, 1, main);
      R(c, 14, 15, 11, 10, main); R(c, 16, 17, 7, 7, light);
      R(c, 15 + Math.max(0, a), 25, 3, 6, main); R(c, 21 - Math.min(0, a), 25, 3, 6, main);
      R(c, 11, 15 - a, 3, 9, main); R(c, 25, 15 + a, 3, 9, main);
      R(c, 14, 4, 11, 11, main); R(c, 16, 7, 8, 7, light); R(c, 12, 7, 2, 4, light); R(c, 25, 7, 2, 4, light);
      face(c, 18, 8, p, 3); mouth(c, 18, 12, p, 4);
      break;
    }
    case 'snake': {
      for (let k = 0; k < 6; k++) R(c, 4 + k * 4, 25 + Math.round(Math.sin(p.phase * Math.PI * 2 + k) * 1.5), 5, 4, k % 2 ? main : dark);
      R(c, 27, 20, 8, 7, main); R(c, 28, 26, 6, 1, light);
      face(c, 31, 21, p, 0);
      if (p.mouthOpen || (p.phase * 3) % 1 < 0.3) { R(c, 35, 24, 3, 1, '#e53935'); R(c, 38, 23, 1, 1, '#e53935'); R(c, 38, 25, 1, 1, '#e53935'); }
      break;
    }
    case 'baby': {
      R(c, 16, 30, 3, 1, light); R(c, 21, 30, 3, 1, light);
      R(c, 15, 21, 10, 9, main); R(c, 16, 26, 8, 1, dark);
      R(c, 12, 22 - Math.max(0, a), 3, 3, light); R(c, 25, 22 + Math.min(0, a), 3, 3, light);
      R(c, 14, 11, 12, 10, light); R(c, 19, 9, 2, 2, '#7a4a1f'); R(c, 20, 8, 2, 1, '#7a4a1f');
      R(c, 15, 17, 2, 1, '#f48fb1'); R(c, 23, 17, 2, 1, '#f48fb1');
      face(c, 17, 14, p, 5); mouth(c, 18, 18, p, 4);
      break;
    }
    case 'banana':
      R(c, 13, 27, 14, 3, main); R(c, 11, 25, 3, 3, main); R(c, 26, 25, 3, 3, main); R(c, 14, 30, 12, 1, dark);
      R(c, 15, 27, 10, 1, light); R(c, 10, 24, 2, 2, '#6d4c41'); R(c, 28, 24, 1, 1, '#6d4c41');
      break;
    case 'cookie':
      R(c, 16, 22, 8, 1, main); R(c, 15, 23, 10, 7, main); R(c, 16, 30, 8, 1, main); R(c, 15, 23, 10, 1, light);
      R(c, 17, 25, 2, 2, dark); R(c, 21, 24, 2, 2, dark); R(c, 20, 28, 2, 1, dark); R(c, 23, 27, 1, 1, dark);
      break;
    case 'pizza':
      for (let j = 0; j < 11; j++) R(c, 13, 20 + j, 3 + Math.round(j * 1.2), 1, main);
      R(c, 12, 20, 3, 11, dark);
      R(c, 15, 25, 2, 2, light); R(c, 18, 28, 2, 2, light); R(c, 14, 29, 1, 1, light);
      break;
    case 'carrot':
      R(c, 13, 25, 13, 4, main); R(c, 26, 26, 3, 2, main); R(c, 29, 27, 1, 1, main); R(c, 16, 26, 1, 1, dark); R(c, 21, 27, 1, 1, dark);
      R(c, 9, 24, 4, 1, light); R(c, 9, 26, 4, 1, light); R(c, 10, 28, 3, 1, light); R(c, 11, 25, 2, 3, light);
      break;
    case 'egg':
      R(c, 18, 20, 4, 1, main); R(c, 17, 21, 6, 2, main); R(c, 16, 23, 8, 7, main); R(c, 17, 30, 6, 1, main);
      R(c, 18, 23, 2, 2, light); R(c, 16, 29, 8, 1, dark);
      break;
    case 'car':
      R(c, 7, 20, 26, 7, main); R(c, 12, 14, 15, 6, main); R(c, 7, 26, 26, 1, dark);
      R(c, 14, 15, 5, 4, light); R(c, 21, 15, 5, 4, light); R(c, 32, 21, 1, 2, '#fff59d'); R(c, 7, 21, 1, 2, '#e53935');
      R(c, 10, 26, 5, 5, K); R(c, 25, 26, 5, 5, K); R(c, 12, 28, 1, 1, '#cfd8dc'); R(c, 27, 28, 1, 1, '#cfd8dc');
      break;
    case 'kite':
      for (let j = 0; j < 13; j++) { const w = (j < 6 ? j : 12 - j) * 2 + 1; R(c, 20 - (w - 1) / 2, 6 + j, w, 1, j < 6 ? main : dark); }
      R(c, 20, 6, 1, 13, light); R(c, 15, 12, 11, 1, light);
      R(c, 19, 19, 1, 2, K); R(c, 21, 21, 1, 2, K); R(c, 19, 23, 1, 2, K); R(c, 21, 25, 1, 2, K);
      R(c, 18, 21, 1, 1, '#fdd835'); R(c, 22, 25, 1, 1, '#fdd835');
      break;
    case 'hat':
      R(c, 11, 29, 18, 2, main); R(c, 14, 17, 12, 12, main); R(c, 14, 25, 12, 2, light); R(c, 15, 18, 2, 6, '#455a64');
      break;
    case 'drum':
      R(c, 12, 21, 16, 10, main); R(c, 12, 19, 16, 3, light); R(c, 12, 30, 16, 1, dark);
      for (let k = 0; k < 4; k++) { R(c, 13 + k * 4, 23, 1, 3, '#fdd835'); R(c, 15 + k * 4, 26, 1, 3, '#fdd835'); }
      R(c, 14, 13, 1, 7, '#8d6e63'); R(c, 25, 13, 1, 7, '#8d6e63'); R(c, 13, 12, 3, 2, '#fff'); R(c, 24, 12, 3, 2, '#fff');
      break;
    case 'rock':
      R(c, 16, 21, 7, 1, main); R(c, 13, 22, 13, 2, main); R(c, 11, 24, 18, 7, main); R(c, 11, 30, 18, 1, dark);
      R(c, 15, 23, 4, 1, light); R(c, 13, 25, 3, 1, light); R(c, 22, 27, 3, 1, dark); R(c, 18, 28, 2, 1, dark);
      break;
  }
}

/* ---------------- Backgrounds ---------------- */

function sky(c: Ctx, t: number, bands = ['#9fd8f5', '#b4e2f8', '#c9ecfa', '#dcf3fc']) {
  bands.forEach((col, i) => R(c, -EX, i * 22, FW(), 22, col));
  R(c, -EX, 88, FW(), 40, bands[bands.length - 1]);
  const span = FW() + 60;
  const cx = t * 3;
  for (const [x, y] of [[cx, 14], [cx + 70, 26], [cx + 150, 18]]) {
    const xx = ((x % span) + span) % span - 30 - EX;
    R(c, xx, y, 18, 4, '#ffffff'); R(c, xx + 4, y - 3, 10, 3, '#ffffff');
  }
}
function grass(c: Ctx, y = 104, col = '#7cc35a', dark = '#5aa33c') {
  R(c, -EX, y, FW(), SH - y, col);
  for (let x = 3 - EX; x < SW + EX; x += 9) { const o = (((x * 7) % 11) + 11) % 11; R(c, x, y + 4 + o, 1, 2, dark); R(c, x + 1, y + 3 + o, 1, 1, dark); }
  R(c, -EX, y, FW(), 1, dark);
}
function farHills(c: Ctx) {
  for (let x = -EX; x < SW + EX; x++) {
    const h = 10 + Math.round(Math.sin(x / 13) * 4 + Math.sin(x / 7) * 2);
    R(c, x, 104 - h, 1, h, '#a5d68a');
  }
}
function tree(c: Ctx, x: number, y: number, s = 1) {
  R(c, x - 3 * s, y - 34 * s, 6 * s, 34 * s, '#7b5230');
  R(c, x - 18 * s, y - 56 * s, 36 * s, 18 * s, '#3f9b4a'); R(c, x - 14 * s, y - 62 * s, 28 * s, 8 * s, '#3f9b4a'); R(c, x - 20 * s, y - 44 * s, 40 * s, 10 * s, '#3f9b4a');
  R(c, x - 10 * s, y - 58 * s, 8 * s, 4 * s, '#5cb85c'); R(c, x + 4 * s, y - 50 * s, 6 * s, 3 * s, '#5cb85c');
}
function flowers(c: Ctx, y: number) {
  for (const [x, col] of [[12, '#f06292'], [34, '#fff176'], [58, '#ffffff'], [128, '#f06292']] as [number, string][]) { R(c, x, y + 6, 1, 3, '#2e7d32'); pattern(c, x - 1, y + 4, PLUS, col); }
}
function house(c: Ctx) {
  R(c, 84, 72, 46, 32, '#f4e1c1'); R(c, 84, 72, 46, 2, '#d7b98e');
  for (let i = 0; i < 18; i++) R(c, 80 + i, 72 - i, 54 - i * 2, 1, '#c0504d');
  R(c, 100, 86, 11, 18, '#7b4a2a'); R(c, 108, 95, 1, 1, '#ffd54f');
  R(c, 88, 80, 9, 8, '#9fd8f5'); R(c, 92, 80, 1, 8, '#ffffff'); R(c, 88, 84, 9, 1, '#ffffff');
  R(c, 116, 80, 9, 8, '#9fd8f5'); R(c, 120, 80, 1, 8, '#ffffff'); R(c, 116, 84, 9, 1, '#ffffff');
}
function hill(c: Ctx) {
  for (let x = 54; x < 147; x++) { const y = terrain('hill', x); R(c, x, y, 1, 104 - y + 1, '#6fb84e'); R(c, x, y, 1, 1, '#4f9a33'); }
}
function bridge(c: Ctx, t: number) {
  R(c, 74, 104, 52, 24, '#4aa3df');
  for (let i = 0; i < 6; i++) R(c, 78 + ((i * 9 + t * 6) % 44), 108 + (i % 3) * 6, 5, 1, '#bfe6fb');
  R(c, 96, 112, 10, 4, '#8d8d8d'); R(c, 97, 111, 8, 1, '#a9a9a9');
  for (let x = 58; x < 142; x++) { const y = terrain('bridge', x, true); R(c, x, y, 1, 4, '#8b5a2b'); R(c, x, y, 1, 1, '#a9743f'); if (x % 8 === 0) R(c, x, y - 6, 1, 6, '#8b5a2b'); }
  for (let x = 58; x < 142; x++) R(c, x, terrain('bridge', x, true) - 6, 1, 1, '#a9743f');
  R(c, 58, 92, 4, 12, '#8b5a2b'); R(c, 138, 92, 4, 12, '#8b5a2b');
}
function pond(c: Ctx, t: number) {
  const w = geo('pond').water!;
  for (let y = 0; y < 18; y++) {
    const half = Math.round(Math.sqrt(1 - ((y - 9) / 10) ** 2) * 38);
    R(c, 103 - half, w.y - 2 + y, half * 2, 1, y < 2 ? '#7fc4ec' : '#4aa3df');
  }
  for (let i = 0; i < 5; i++) R(c, 74 + ((i * 13 + t * 5) % 56), 108 + (i % 3) * 3, 4, 1, '#bfe6fb');
  R(c, 70, 102, 3, 2, '#2e7d32'); R(c, 134, 104, 3, 2, '#2e7d32');
}
function beach(c: Ctx, t: number) {
  R(c, -EX, 0, FW(), 88, '#a7dcf6'); R(c, 8, 10, 14, 14, '#ffe082'); R(c, 6, 14, 18, 6, '#ffe082');
  R(c, -EX, 82, FW(), 18, '#5bb6e8');
  R(c, -EX, 100, FW(), 28, '#f3d99b');
  for (let y = 98; y < SH; y++) { const x0 = 98 + Math.round((y - 98) * 0.25 + Math.sin(t * 2 + y / 3)); R(c, x0, y, SW + EX - x0, 1, '#4aa3df'); }
  for (let i = 0; i < 6; i++) R(c, 104 + ((i * 11 + t * 6) % 38), 104 + (i % 4) * 5, 4, 1, '#bfe6fb');
  R(c, 30, 112, 3, 2, '#e8b04a'); R(c, 60, 118, 2, 1, '#ffffff');
}
function forest(c: Ctx) {
  for (let i = 0; i < 9 + Math.ceil(EX / 11); i++) tree(c, 64 + i * 11, 104 - (i % 2) * 6, 0.7);
}
function room(c: Ctx) {
  R(c, -EX, 0, FW(), 108, '#f8e7c9');
  for (let x = -EX; x < SW + EX; x += 12) R(c, x, 0, 6, 108, '#f3dcb4');
  R(c, -EX, 108, FW(), 20, '#b07a4a'); for (let x = -EX; x < SW + EX; x += 16) R(c, x, 108, 1, 20, '#94643a');
  R(c, 92, 24, 30, 26, '#9fd8f5'); R(c, 92, 24, 30, 2, '#ffffff'); R(c, 106, 24, 2, 26, '#ffffff'); R(c, 92, 36, 30, 2, '#ffffff');
  R(c, 14, 76, 34, 4, '#8d6e63'); R(c, 16, 80, 3, 28, '#6d4c41'); R(c, 43, 80, 3, 28, '#6d4c41');
  R(c, 24, 70, 6, 6, '#e57373');
}

function barn(c: Ctx) {
  for (let x = 2; x < 72; x += 10) R(c, x, 92, 2, 12, '#fafafa');
  R(c, 0, 95, 74, 2, '#fafafa'); R(c, 0, 100, 74, 2, '#fafafa');
  R(c, 92, 70, 38, 34, '#c62828'); R(c, 92, 70, 38, 2, '#8e1b1b');
  for (let i = 0; i < 14; i++) R(c, 88 + i, 70 - i, 46 - i * 2, 1, '#6d4c41');
  R(c, 103, 84, 16, 20, '#8e1b1b'); R(c, 103, 84, 16, 1, '#fafafa'); R(c, 103, 84, 1, 20, '#fafafa'); R(c, 118, 84, 1, 20, '#fafafa');
  for (let k = 0; k < 16; k++) { R(c, 103 + k, 84 + Math.round(k * 1.25), 1, 1, '#fafafa'); R(c, 118 - k, 84 + Math.round(k * 1.25), 1, 1, '#fafafa'); }
  R(c, 107, 72, 8, 6, '#fafafa'); R(c, 108, 73, 6, 4, '#3e2723');
  R(c, 132, 82, 8, 22, '#bdbdbd'); R(c, 132, 79, 8, 3, '#9e9e9e');
}
function garden(c: Ctx) {
  for (let x = 58; x < 146; x += 6) { R(c, x, 84, 3, 20, '#fafafa'); R(c, x + 1, 83, 1, 1, '#fafafa'); }
  R(c, 58, 88, 88, 2, '#fafafa'); R(c, 58, 96, 88, 2, '#fafafa');
  const cols = ['#f06292', '#fdd835', '#ba68c8', '#ff7043', '#ffffff'];
  for (let row = 0; row < 2; row++) for (let k = 0; k < 13; k++) {
    const x = 62 + k * 7 + row * 3; const y = 92 + row * 7;
    R(c, x + 1, y + 2, 1, 4, '#2e7d32'); R(c, x + 2, y + 4, 2, 1, '#43a047'); pattern(c, x, y, PLUS, cols[(k + row * 2) % cols.length]);
  }
}
function school(c: Ctx) {
  R(c, 80, 60, 56, 44, '#e3a869'); R(c, 80, 60, 56, 2, '#c7884a');
  for (let y = 66; y < 104; y += 6) R(c, 80, y, 56, 1, '#d4975a');
  R(c, 77, 56, 62, 4, '#6d4c41');
  R(c, 102, 42, 12, 14, '#e3a869'); R(c, 100, 39, 16, 3, '#6d4c41'); R(c, 106, 45, 4, 4, '#fdd835'); R(c, 107, 49, 2, 1, '#fdd835');
  R(c, 101, 84, 14, 20, '#5d4037'); R(c, 107, 84, 1, 20, '#3e2723'); R(c, 104, 93, 1, 1, '#fdd835'); R(c, 110, 93, 1, 1, '#fdd835');
  for (const x of [85, 120]) { R(c, x, 68, 11, 9, '#9fd8f5'); R(c, x + 5, 68, 1, 9, '#fff'); R(c, x, 72, 11, 1, '#fff'); R(c, x, 84, 11, 9, '#9fd8f5'); R(c, x + 5, 84, 1, 9, '#fff'); }
  R(c, 126, 30, 1, 30, '#9e9e9e'); R(c, 127, 30, 8, 5, '#e53935'); R(c, 127, 32, 8, 1, '#fafafa');
}
function cave(c: Ctx) {
  for (let x = 66; x < SW + EX; x++) {
    const d = (x - 108) / 44;
    const top = Math.round(46 + Math.min(1, d * d) * 54);
    R(c, x, top, 1, 104 - top, '#7b7b7b'); R(c, x, top, 1, 2, '#9e9e9e');
  }
  R(c, 80, 72, 6, 3, '#8f8f8f'); R(c, 124, 66, 7, 3, '#8f8f8f'); R(c, 96, 58, 5, 2, '#8f8f8f');
  for (let y = 0; y < 26; y++) { const half = Math.round(Math.sqrt(1 - ((26 - y) / 26) ** 2) * 15); R(c, 107 - half, 78 + y, half * 2, 1, y < 2 ? '#424242' : '#1c1c1c'); }
  R(c, 92, 101, 4, 3, '#616161'); R(c, 120, 100, 5, 4, '#616161');
}

export function drawBackground(c: Ctx, place: string, t: number) {
  if (place === 'room') { room(c); return; }
  if (place === 'beach') { beach(c, t); return; }
  sky(c, t);
  farHills(c);
  if (place === 'forest') { R(c, 60, 46, 84 + EX, 58, '#2f7d3a'); }
  grass(c, 104);
  if (place === 'meadow' || place === 'park') flowers(c, 104);
  if (place === 'park') { tree(c, 118, 104, 0.8); R(c, 82, 94, 22, 3, '#8d6e63'); R(c, 82, 90, 22, 2, '#8d6e63'); R(c, 84, 97, 2, 7, '#6d4c41'); R(c, 100, 97, 2, 7, '#6d4c41'); }
  if (place === 'pond') pond(c, t);
  if (place === 'forest') forest(c);
  if (place === 'house') house(c);
  if (place === 'hill') hill(c);
  if (place === 'tree') tree(c, 104, 104, 1);
  if (place === 'bridge') bridge(c, t);
  if (place === 'farm') barn(c);
  if (place === 'garden') garden(c);
  if (place === 'school') school(c);
  if (place === 'cave') cave(c);
}

/** Parts of a place that stand in front of anyone behind them. */
function occluder(c: Ctx, place: string, bush: boolean) {
  if (place === 'house') house(c);
  if (place === 'school') school(c);
  if (place === 'cave') cave(c);
  if (place === 'hill') hill(c);
  if (place === 'tree') R(c, 101, 70, 6, 34, '#7b5230');
  if (place === 'forest') forest(c);
  if (bush) { R(c, 86, 92, 26, 12, '#3f9b4a'); R(c, 89, 88, 20, 4, '#3f9b4a'); R(c, 92, 90, 4, 2, '#5cb85c'); R(c, 102, 94, 4, 2, '#5cb85c'); }
}

/* ---------------- Who does what, frame by frame ---------------- */

interface Draw {
  spec: ActorSpec; look: LookId; x: number; y: number; scale: number; facing: 1 | -1; rot: number; alpha: number; pose: Pose;
  behind?: boolean; water?: number; squash?: number; tint?: [string, number]; label?: string;
}
interface Frame { draws: Draw[]; low: ((c: Ctx) => void)[]; hi: ((h: Ctx) => void)[]; shake: number; bush: boolean }

const BASE_SPEED: Partial<Record<VerbId, number>> = { run: 42, walk: 18, jump: 22, swim: 18, fly: 34, roll: 28, bounce: 22, crawl: 9 };
const ARRIVE: Partial<Record<VerbId, number>> = { run: 0.3, walk: 0.55, jump: 0.5, swim: 0.5, fly: 0.35, roll: 0.4, bounce: 0.5, crawl: 0.75 };
const PHASE: Partial<Record<VerbId, number>> = { run: 3, walk: 1.6, swim: 1.2, fly: 3, roll: 1, bounce: 1, jump: 1, crawl: 1.2 };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const ease = (p: number) => p * p * (3 - 2 * p);

function pingpong(start: number, dist: number, min: number, max: number): { x: number; facing: 1 | -1 } {
  const span = max - min;
  if (span <= 0) return { x: min, facing: 1 };
  let d = ((start - min + dist) % (2 * span) + 2 * span) % (2 * span);
  if (d <= span) return { x: min + d, facing: 1 };
  d -= span;
  return { x: max - d, facing: -1 };
}

function speedOf(g: GroupModel, a: ActorSpec): number {
  let m = 1;
  for (const id of g.advs) m *= id === 'quickly' || id === 'wildly' ? 2.2 : id === 'slowly' || id === 'lazily' ? 0.4 : id === 'carefully' || id === 'gently' || id === 'calmly' ? 0.6 : 1;
  for (const id of a.adjs) m *= id === 'fast' || id === 'speedy' ? 1.8 ** a.intensity : id === 'slow' ? 0.45 ** a.intensity : id === 'sleepy' || id === 'tired' ? 0.7 : 1;
  return m;
}

function scaleOf(a: ActorSpec): number {
  let s = 1;
  for (const id of a.adjs) s *= id === 'big' ? 1.45 ** a.intensity : id === 'huge' ? 1.8 ** a.intensity : id === 'small' || id === 'little' ? 0.65 ** a.intensity : id === 'tiny' ? 0.45 ** a.intensity : 1;
  return s;
}

function palOf(a: ActorSpec, extraAdjs: string[] = []): Pal {
  const base = BASE_PAL[a.look];
  const col = [...a.adjs, ...extraAdjs].map((id) => COLOR[id]).find(Boolean);
  return col ? { ...base, main: col, dark: shade(col, 0.68) } : base;
}

const MOOD_ADJ: Record<string, 'happy' | 'sad'> = {
  happy: 'happy', silly: 'happy', sad: 'sad', scared: 'sad', angry: 'sad', cold: 'sad',
  excited: 'happy', cheerful: 'happy', funny: 'happy', brave: 'happy', grumpy: 'sad',
};
/** New describing words that show like one the video already draws (tired looks sleepy). */
const FX_LIKE: Record<string, string> = { excited: 'happy', cheerful: 'happy', tired: 'sleepy', funny: 'silly', grumpy: 'angry', sparkly: 'shiny', speedy: 'fast', brave: 'shiny' };

function mkDraw(spec: ActorSpec, x: number, y: number, extra: Partial<Draw> = {}, stateAdjs: string[] = []): Draw {
  const adjs = [...spec.adjs, ...stateAdjs];
  const mood = adjs.map((id) => MOOD_ADJ[id]).find(Boolean) ?? 'none';
  const tint: [string, number] | undefined = adjs.includes('cold') ? ['#9fd3ff', 0.35] : adjs.includes('hot') ? ['#ff7043', 0.25] : adjs.includes('angry') || adjs.includes('grumpy') ? ['#ff1744', 0.2] : undefined;
  return {
    spec, look: spec.look, x, y, scale: scaleOf({ ...spec, adjs }), facing: 1, rot: 0, alpha: 1,
    pose: { moving: false, phase: 0, mood, eyesClosed: adjs.includes('sleepy') || adjs.includes('tired') },
    tint, label: spec.name ?? spec.tag, ...extra,
  };
}

/** Feelings and states you can see: hearts, rain clouds, drips, sparkles... */
function adjFx(f: Frame, d: Draw, adjs: string[], t: number, intensity: number) {
  const top = d.y - 30 * d.scale;
  const n = intensity > 1 ? 2 : 1;
  for (const id of adjs) {
    if (id === 'dirty') {
      f.low.push((c) => { for (let k = 0; k < 5; k++) R(c, d.x - 9 * d.scale + ((k * 7) % 17) * d.scale, d.y - (6 + ((k * 5) % 14)) * d.scale, 2, 2, '#6d4c41'); });
      if ((t % 2) < 1) f.low.push((c) => { for (let k = 0; k < 2; k++) R(c, d.x - 4 + k * 8, top - 4 - ((t * 6 + k) % 4), 1, 1, '#424242'); });
      continue;
    }
    if (id === 'excited') d.y -= Math.abs(Math.sin(t * 7)) * 3;
    switch (FX_LIKE[id] ?? id) {
      case 'happy':
        f.low.push((c) => { for (let k = 0; k < 2 * n; k++) { const ph = (t * 0.7 + k / (2 * n)) % 1; pattern(c, d.x - 6 + k * 7, top - ph * 16, HEART, ph < 0.8 ? '#ff5c8a' : '#ffb3c7'); } });
        break;
      case 'sad':
        f.low.push((c) => {
          R(c, d.x - 9, top - 9, 18, 5, '#8e9aaf'); R(c, d.x - 6, top - 12, 11, 3, '#8e9aaf');
          for (let k = 0; k < 3 * n; k++) { const ph = (t * 1.5 + k / (3 * n)) % 1; R(c, d.x - 7 + k * (14 / (3 * n)) * 2, top - 3 + ph * 12, 1, 2, '#4aa3df'); }
        });
        break;
      case 'sleepy':
        f.low.push((c) => { const ph = (t * 0.5) % 1; pattern(c, d.x + 8 + ph * 6, top - ph * 10, ZED, '#5c6bc0'); });
        break;
      case 'angry':
        f.low.push((c) => { for (let k = 0; k < 2; k++) { const ph = (t * 1.2 + k / 2) % 1; R(c, d.x - 6 + k * 10, top - ph * 10, 3 - Math.round(ph * 2), 3 - Math.round(ph * 2), '#cfd8dc'); } });
        break;
      case 'scared':
        d.x += Math.sin(t * 60) > 0 ? 1 : -1;
        f.low.push((c) => { const ph = (t * 1.3) % 1; R(c, d.x + 8, top + 6 + ph * 8, 1, 2, '#81d4fa'); R(c, d.x - 9, top + 8 + ph * 6, 1, 2, '#81d4fa'); });
        break;
      case 'silly':
        d.rot += Math.sin(t * 8) * 0.18; d.pose.mouthOpen = true;
        break;
      case 'hungry':
        f.low.push((c) => {
          if ((t % 3) < 1.6) {
            R(c, d.x + 4, top - 14, 14, 11, '#ffffff'); R(c, d.x + 2, top - 3, 2, 2, '#ffffff'); R(c, d.x, top, 1, 1, '#ffffff');
            R(c, d.x + 8, top - 11, 6, 5, '#e53935'); R(c, d.x + 10, top - 13, 1, 2, '#6d4c41');
          }
        });
        break;
      case 'wet':
        f.low.push((c) => { for (let k = 0; k < 3; k++) { const ph = (t * 1.6 + k / 3) % 1; R(c, d.x - 6 + k * 6, d.y - 14 * d.scale + ph * 14 * d.scale, 1, 2, '#4aa3df'); } });
        break;
      case 'cold':
        d.x += Math.sin(t * 50) > 0 ? 0.6 : -0.6;
        f.low.push((c) => { for (let k = 0; k < 4; k++) { const ph = (t * 0.4 + k / 4) % 1; pattern(c, d.x - 14 + k * 9, top - 6 + ph * 34, PLUS, '#ffffff'); } });
        break;
      case 'hot':
        f.low.push((c) => {
          R(c, d.x + 10, top - 12, 8, 8, '#ffca28'); R(c, d.x + 12, top - 14, 4, 12, '#ffca28'); R(c, d.x + 8, top - 10, 12, 4, '#ffca28');
          const ph = (t * 1.4) % 1; R(c, d.x - 8, top + 4 + ph * 8, 1, 2, '#81d4fa');
        });
        break;
      case 'shiny':
        f.low.push((c) => { for (let k = 0; k < 3 * n; k++) { const on = ((t * 2 + k * 0.37) % 1) < 0.5; if (on) pattern(c, d.x - 12 + ((k * 17) % 26), top + ((k * 11) % 24), PLUS, '#fff59d'); } });
        break;
      case 'fast':
        if (d.pose.moving) f.low.push((c) => { for (let k = 0; k < 3; k++) R(c, d.x - d.facing * (14 + k * 3) - 4, d.y - 6 - k * 5, 6, 1, '#ffffff'); });
        break;
    }
  }
}

function bubble(f: Frame, x: number, y: number, text: string, size: number, alpha = 1) {
  f.hi.push((h) => {
    const fam = getComputedStyle(document.documentElement).getPropertyValue('--lm-font') || 'sans-serif';
    h.save();
    h.globalAlpha = alpha;
    h.font = `700 ${size}px ${fam}`;
    const w = h.measureText(text).width + size * 0.9;
    const bh = size * 1.6;
    let bx = x * HI - w / 2;
    bx = clamp(bx, 6 - EX * HI, (SW + EX) * HI - w - 6);
    const by = Math.max(6, y * HI - bh - 10);
    h.fillStyle = '#ffffff'; h.strokeStyle = '#1d1d27'; h.lineWidth = 4;
    roundRect(h, bx, by, w, bh, bh / 2); h.fill(); h.stroke();
    h.beginPath(); h.moveTo(x * HI - 8, by + bh - 1); h.lineTo(x * HI + 2, by + bh + 12); h.lineTo(x * HI + 8, by + bh - 1); h.fill();
    h.fillStyle = '#1d1d27'; h.textAlign = 'center'; h.textBaseline = 'middle';
    h.fillText(text, bx + w / 2, by + bh / 2 + 1);
    h.restore();
  });
}

function thought(f: Frame, x: number, y: number, inner: (c: Ctx, cx: number, cy: number) => void) {
  f.low.push((c) => {
    const bx = clamp(x - 2, 4 - EX, SW + EX - 34);
    const by = Math.max(2, y - 30);
    R(c, bx, by + 2, 32, 22, '#ffffff'); R(c, bx + 2, by, 28, 26, '#ffffff');
    R(c, x - 6, by + 27, 4, 3, '#ffffff'); R(c, x - 9, by + 31, 2, 2, '#ffffff');
    inner(c, bx + 16, by + 23);
    c.fillStyle = '#e53935';
    for (let i = 0; i < 20; i++) { c.fillRect(bx + 6 + i, by + 3 + i, 2, 1); c.fillRect(bx + 26 - i, by + 3 + i, 2, 1); }
  });
}

let spriteCanvas: HTMLCanvasElement | null = null;
function spriteCtx(): Ctx {
  if (!spriteCanvas) { spriteCanvas = document.createElement('canvas'); spriteCanvas.width = 40; spriteCanvas.height = 32; }
  return spriteCanvas.getContext('2d')!;
}

function blit(c: Ctx, d: Draw) {
  const s = spriteCtx();
  s.clearRect(0, 0, 40, 32);
  drawLook(s, d.look, palOf(d.spec), d.pose);
  if (d.tint) { s.save(); s.globalCompositeOperation = 'source-atop'; s.globalAlpha = d.tint[1]; s.fillStyle = d.tint[0]; s.fillRect(0, 0, 40, 32); s.restore(); }
  c.save();
  c.globalAlpha = d.alpha;
  c.translate(Math.round(d.x), Math.round(d.y));
  c.rotate(d.rot);
  c.scale(d.facing * d.scale, d.scale * (d.squash ?? 1));
  c.drawImage(spriteCanvas!, -20, -31);
  c.restore();
  if (d.water !== undefined) {
    const w = 18 * d.scale;
    R(c, d.x - w, d.water, w * 2, Math.max(0, d.y - d.water + 2), 'rgba(74,163,223,0.9)');
    R(c, d.x - w, d.water, w * 2, 1, '#bfe6fb');
  }
}

function miniLook(c: Ctx, look: LookId, pose: Pose, cx: number, cy: number, spec?: ActorSpec) {
  const s = spriteCtx();
  s.clearRect(0, 0, 40, 32);
  drawLook(s, look, spec ? palOf(spec) : BASE_PAL[look], pose);
  c.save(); c.translate(cx, cy); c.scale(0.6, 0.6); c.drawImage(spriteCanvas!, -20, -31); c.restore();
}

function groupFrame(f: Frame, g: GroupModel, gi: number, clip: Clip, t: number) {
  const place = clip.place;
  const G = geo(place);
  const a0 = clip.a.intj ? 1.2 : 0.6;
  const a1 = clip.duration - 0.5;
  const W = a1 - a0;
  let ta = clamp(t - a0, 0, W);
  const lane = gi === 0 ? 0 : -10;
  const n = g.actors.length;
  const verb = g.verbs[0];
  const vd = verb ? verbById(verb) : undefined;
  // A verb that moves like another one (hop like jump, follow like chase) uses its moves.
  const av: VerbId = vd?.anim ?? verb;
  const sudden = g.advs.includes('suddenly');
  if (sudden && g.kind === 'action' && !g.negated) {
    const wait = 0.3 * W;
    if (ta < wait) ta = 0; else ta = (ta - wait) * 1.6;
    if (t > a0 + wait - 0.1 && t < a0 + wait + 0.9) bubble(f, (g.actors[0] ? 30 : 72), G.ground - 34, '!', 40);
  }
  const loud = g.advs.includes('loudly') || g.advs.includes('noisily');
  const quiet = g.advs.includes('quietly') || g.advs.includes('softly');
  const happyAdv = g.advs.includes('happily');
  const sadAdv = g.advs.includes('sadly');
  const extraAdjs = [...(happyAdv ? ['happy'] : []), ...(sadAdv ? ['sad'] : [])];
  const stateAdjs = g.kind === 'state' && !g.negated ? g.adjs.map((x) => x.id) : [];
  const stateIntensity = Math.max(1, ...g.adjs.map((x) => x.intensity));
  const centerX = gi === 0 ? (clip.a.groups.length > 1 ? 50 : 72) : 100;
  const spread = (i: number) => (i - (n - 1) / 2) * 20;
  const ph = g.prep;
  // A phrase with a person, animal or thing in it ("from the cat", "near the dog"): that one stands in the scene.
  const po = g.prepObj[0];
  const objX = ph === 'to' ? 112 : ph === 'over' ? 84 : ph === 'behind' ? 92 : 98;
  let sp: Spot | null = g.place && g.place === place ? spot(place, ph) : g.place && place === 'room' && ph === 'in' ? spot('room', undefined) : null;
  if (po && ph === 'near') sp = { x: objX - 26, y: G.ground };
  if (po && ph === 'behind') sp = { x: objX, y: G.ground, behind: true };
  const LX = po ? objX : G.lx;

  const push = (d: Draw, i: number, adjsForFx: string[], intensity: number) => {
    adjFx(f, d, adjsForFx, t + i * 0.37, intensity);
    if (d.label) {
      const lx = d.x; const ly = d.y - 31 * d.scale * (d.squash ?? 1); const label = d.label;
      f.hi.push((h) => tag(h, lx, ly, label));
    }
    f.draws.push(d);
  };

  if (po && ph && ph !== 'from') {
    g.prepObj.forEach((o, k) => {
      const d = mkDraw(o, objX + k * 14, G.ground + lane, { facing: -1 });
      d.pose.eyesClosed = (t % 3.1) < 0.15;
      push(d, 20 + k, o.adjs, o.intensity);
    });
  }

  // Not: the Who stays put and thinks about it.
  if (g.negated) {
    g.actors.forEach((spec, i) => {
      const d = mkDraw(spec, (sp?.x ?? centerX) + spread(i), (sp?.y ?? G.ground) + lane, {}, stateAdjs);
      d.facing = Math.sin(t * 0.9 + i) > 0 ? 1 : -1;
      d.pose.eyesClosed = d.pose.eyesClosed || (t % 3.2) < 0.15;
      if (i === 0 && t > a0 + 0.2) {
        thought(f, d.x + 6, d.y - 26 * d.scale, (c, cx, cy) => {
          if (g.kind === 'action' && verb) miniLook(c, spec.look, { moving: true, phase: t * 2, wingsUp: verb === 'fly' && (t * 4) % 1 < 0.5, mouthOpen: vd?.motion === 'sound' }, cx, cy - (verb === 'fly' || verb === 'jump' ? 4 : 0), spec);
          else if (g.kind === 'state') { const id = g.adjs[0]?.id ?? ''; miniLook(c, spec.look, { moving: false, phase: 0, mood: MOOD_ADJ[id] ?? 'none', eyesClosed: id === 'sleepy' }, cx, cy, { ...spec, adjs: [id] }); }
          else if (g.kind === 'identity' && g.ident[0]) miniLook(c, g.ident[0].look, { moving: false, phase: 0 }, cx, cy, g.ident[0]);
        });
      }
      push(d, i, [...extraAdjs], 1);
    });
    return;
  }

  // Be + describing words, be + a noun, be + a place.
  if (g.kind !== 'action' || !vd) {
    g.actors.forEach((spec, i) => {
      let look = spec.look;
      let poof = false;
      if (g.kind === 'identity' && g.ident[0]) {
        const target = g.ident[0];
        if (target.look !== spec.look) {
          const at = 0.4 * W;
          if (ta >= at) look = target.look;
          poof = ta > at - 0.2 && ta < at + 0.5;
        }
      }
      const s2 = g.kind === 'identity' && g.ident[0] ? { ...spec, look, adjs: [...spec.adjs, ...(g.ident[0].adjs ?? [])] } : spec;
      const base = g.kind === 'location' && sp ? sp : { x: centerX, y: G.ground };
      const wet = G.water && spec.look === 'fish';
      const d = mkDraw(s2, base.x + spread(i), (wet ? G.water!.swim : base.y) + lane, { behind: (base as Spot).behind }, stateAdjs);
      d.squash = 1 + Math.sin(t * 3 + i) * 0.02;
      d.pose.eyesClosed = d.pose.eyesClosed || (t % 3.4) < 0.15;
      if (wet) { d.water = G.water!.y; d.pose.moving = true; d.pose.phase = t; }
      if (poof) f.low.push((c) => { for (let k = 0; k < 8; k++) { const ang = (k / 8) * Math.PI * 2; R(c, d.x + Math.cos(ang) * 12 - 2, d.y - 14 + Math.sin(ang) * 10 - 2, 5, 5, '#eeeeee'); } });
      push(d, i, [...stateAdjs, ...extraAdjs], stateIntensity);
    });
    return;
  }

  const motion = vd.motion;
  const obj = g.object[0];

  g.actors.forEach((spec, i) => {
    const m = speedOf(g, spec);
    const lag = i * 15;
    const d = mkDraw(spec, centerX, G.ground + lane - i * 2, {}, []);
    const P = PHASE[av] ?? 1.5;
    d.pose.phase = ta * P * m;

    if (motion === 'loco') {
      const isSwim = av === 'swim';
      const water = G.water;
      const moving = MOVING_PREPS_SET.has(ph ?? '') && !(po && ph === 'from');
      if (spec.look === 'fish' || (isSwim && water && !moving)) {
        const r = pingpong(water ? water.x0 + 8 : 20, ta * (BASE_SPEED.swim ?? 18) * m - lag, (water?.x0 ?? 10) + 8, (water?.x1 ?? 134) - 8);
        d.x = r.x; d.facing = r.facing; d.y = (water?.swim ?? G.ground) + Math.sin(t * 3 + i) * 1 + lane;
        if (water) d.water = water.y;
        d.pose.moving = true;
      } else if (moving && ph) {
        const T = clamp(((ARRIVE[av] ?? 0.5) * W) / m, 0.5, W);
        const p = clamp((ta - i * 0.15) / T, 0, 1);
        const x0 = ph === 'across' || ph === 'through' ? 4 - EX : 14 - EX * 0.6;
        let x1 = LX - 22;
        if (ph === 'into') x1 = place === 'house' ? 105 : place === 'school' ? 108 : place === 'cave' ? 107 : place === 'pond' ? 96 : 100;
        if (ph === 'over') x1 = LX + 36;
        if (ph === 'across' || ph === 'through') x1 = 140 + EX;
        if (ph === 'up') x1 = place === 'tree' ? G.lx - 8 : G.lx;
        if (!po && place === 'pond' && ph === 'to') x1 = 56;
        if (!po && place === 'beach' && ph === 'to') x1 = 86;
        const pp = ph === 'up' && place === 'tree' ? clamp(p * 2, 0, 1) : p;
        d.x = lerp(x0, x1, pp) - lag * (1 - p);
        d.facing = 1;
        const deck = place === 'bridge' && (ph === 'across');
        d.y = terrain(place, d.x, deck) + lane - i * 2;
        if (ph === 'over') d.y -= Math.sin(Math.PI * p) * (!po && place === 'hill' ? 46 : 26);
        if (ph === 'up' && place === 'tree' && p > 0.5) d.y = lerp(G.ground, 62, ease((p - 0.5) * 2));
        d.pose.moving = p < 1;
        if (p >= 1) {
          if (ph === 'into' && place !== 'pond') d.alpha = clamp(1 - (ta - T) / 0.5, 0, 1);
          if (ph === 'into' && place === 'pond') { d.x = 100 - lag; d.y = 113; d.water = 104; d.pose.moving = true; }
          if (ph === 'across' || ph === 'through') d.alpha = clamp(1 - (ta - T) / 0.4, 0, 1);
        }
      } else if (po && ph === 'from') {
        // Running from someone: they chase right behind.
        const v = (BASE_SPEED[av] ?? 20) * m;
        const r = pingpong(60, v * ta - lag, 30 - EX * 0.6, 132 + EX * 0.6);
        d.x = r.x; d.facing = r.facing; d.pose.moving = ta > 0;
        d.y = G.ground + lane - i * 2;
        if (i === 0) {
          g.prepObj.forEach((o, k) => {
            const c = mkDraw(o, r.x - r.facing * (30 + k * 14), G.ground + lane + 1, { facing: r.facing });
            c.pose.moving = ta > 0; c.pose.phase = ta * 3 * m;
            push(c, 20 + k, o.adjs, o.intensity);
          });
          if (ta > 0 && (t % 1.6) < 0.8) f.low.push((c) => pattern(c, d.x - 2, d.y - 34 * d.scale, ['X', 'X', 'X', '.', 'X'], '#e53935'));
        }
      } else if (g.advs.includes('away')) {
        const v = (BASE_SPEED[av] ?? 20) * m;
        d.x = 40 + v * ta - lag; d.facing = 1; d.pose.moving = true;
        d.y = G.ground + lane - i * 2;
      } else if (g.advs.includes('around')) {
        const v = (BASE_SPEED[av] ?? 20) * m;
        const ang = (v * ta) / 34 - i * 0.6;
        d.x = 72 + Math.cos(ang) * (40 + EX * 0.6); d.y = G.ground - 4 + Math.sin(ang) * 6 + lane;
        d.facing = Math.sin(ang) > 0 ? -1 : 1; d.pose.moving = true;
      } else {
        const range = sp && place !== 'meadow' && ph && ph !== 'in' ? [sp.x - 24, sp.x + 24] : [14 - EX * 0.8, 130 + EX * 0.8];
        const v = (BASE_SPEED[av] ?? 20) * m;
        const r = pingpong(range[0] + 6, v * ta - lag, range[0], range[1]);
        d.x = r.x; d.facing = r.facing; d.pose.moving = ta > 0 && ta < W;
        d.y = (sp?.deck ? terrain(place, d.x, true) : terrain(place, d.x)) + lane - i * 2;
        if (sp?.behind) d.behind = true;
      }
      if (av === 'jump' || av === 'bounce') {
        const hop = Math.abs(Math.sin(Math.PI * ta * 1.4 * m));
        d.y -= hop * 16 * (av === 'bounce' ? 1.2 : 1);
        d.pose.moving = hop > 0.15;
        if (av === 'bounce') d.squash = hop < 0.1 ? 0.8 : 1;
      }
      if (av === 'fly') {
        const lift = Math.min(1, ta / 0.6) * (ph ? 26 : 44);
        d.y -= lift + Math.sin(t * 3 + i) * 2;
        d.pose.wingsUp = (ta * 5 * m) % 1 < 0.5;
        d.pose.moving = true;
      }
      if (av === 'roll') d.rot = ROUND.includes(spec.look) ? d.x / 6 : LIVING.includes(spec.look) ? d.x / 12 : 0;
      if (av === 'crawl') { d.squash = 0.72; d.y += 1; }
      if (quiet) d.squash = 0.94;
      if (loud && ta > 0) f.shake = Math.max(f.shake, 1);
    } else if (motion === 'static') {
      const base = sp ?? { x: centerX, y: G.ground };
      d.x = base.x + spread(i); d.y = base.y + lane;
      if (base.behind) d.behind = true;
      if (av === 'dance') {
        d.facing = Math.floor(ta * 2.5 * speedOf(g, spec)) % 2 === 0 ? 1 : -1;
        d.y -= Math.abs(Math.sin(ta * 6 * speedOf(g, spec))) * 4;
        d.pose.moving = true; d.pose.mood = 'happy';
        f.low.push((c) => { for (let k = 0; k < 2; k++) { const q = (t * 0.8 + k / 2 + i * 0.3) % 1; pattern(c, d.x - 12 + k * 22, d.y - 34 - q * 12, NOTE, k ? '#7e57c2' : '#ec407a'); } });
      }
      if (av === 'sleep') {
        d.rot = -Math.PI / 2 * clamp(ta / 0.5, 0, 1) * (spec.look === 'fish' ? 0 : 1);
        d.y -= 4; d.pose.eyesClosed = true;
        if (spec.look === 'fish' && G.water) { d.y = G.water.swim; d.water = G.water.y; }
        f.low.push((c) => { for (let k = 0; k < 3; k++) { const q = (t * 0.45 + k / 3) % 1; pattern(c, d.x + 8 + q * 10, d.y - 18 - q * 18, ZED, '#5c6bc0'); } });
      }
      if (av === 'sit') { d.squash = 0.8; }
      if (av === 'spin') {
        d.facing = Math.floor(ta * 6 * speedOf(g, spec)) % 2 === 0 ? 1 : -1; d.pose.moving = true; d.pose.mood = 'happy';
        f.low.push((c) => { for (let k = 0; k < 3; k++) { const ang = t * 6 + (k * Math.PI * 2) / 3; R(c, d.x + Math.cos(ang) * 14, d.y - 14 + Math.sin(ang) * 5, 2, 1, '#ffffff'); } });
      }
      if (av === 'wiggle') { d.rot = Math.sin(t * 12 * speedOf(g, spec)) * 0.16; d.pose.mood = 'happy'; }
      if (av === 'smile') {
        d.pose.mood = 'happy';
        f.low.push((c) => { for (let k = 0; k < 2; k++) if (((t * 2 + k * 0.5) % 1) < 0.6) pattern(c, d.x + (k ? 10 : -14), d.y - 28 * d.scale + k * 4, PLUS, '#fff59d'); });
      }
      if (av === 'wave') {
        d.pose.mood = 'happy';
        const skin = PEOPLE.includes(spec.look) ? BASE_PAL[spec.look].light : BASE_PAL[spec.look].main;
        f.low.push((c) => { const sway = Math.round(Math.sin(t * 9) * 2); pattern(c, d.x + 8 * d.scale + sway, d.y - 33 * d.scale, HAND, skin); R(c, d.x + 9 * d.scale, d.y - 29 * d.scale, 2, 6, skin); });
        if (i === 0 && ta > 0 && ta < 1.4) bubble(f, d.x, d.y - 32 * d.scale, 'Hi!', 28);
      }
      if (av === 'cry') {
        d.pose.mood = 'sad';
        f.low.push((c) => { for (let k = 0; k < 4; k++) { const q = (t * 1.5 + k / 4) % 1; R(c, d.x + (k % 2 ? 4 : -4) + (k % 2 ? q * 6 : -q * 6), d.y - 22 * d.scale + q * 14, 1, 2, '#4aa3df'); } });
      }
      if (av === 'hide') {
        const useBush = !sp?.behind;
        if (useBush) f.bush = true;
        const target = sp?.behind ? sp.x : 99;
        const p = clamp(ta / (0.4 * W), 0, 1);
        d.x = lerp(20, target + spread(i) * 0.4, ease(p)); d.pose.moving = p < 1;
        if (p >= 1) { d.behind = true; d.y = base.y + 6 - (((ta % 2.2) < 0.6) ? 6 : 0); }
        if (spec.look === 'fish' && G.water) { d.y = G.water.swim; d.water = G.water.y; }
      }
      if (spec.look === 'fish' && G.water && verb !== 'hide' && verb !== 'sleep') { d.y = G.water.swim; d.water = G.water.y; }
    } else if (motion === 'sound') {
      const base = sp ?? { x: centerX, y: G.ground };
      d.x = base.x + spread(i); d.y = base.y + lane;
      const every = 1.5 / speedOf(g, spec);
      const q = (ta % every) / every;
      const on = ta > 0 && q < 0.6;
      d.pose.mouthOpen = on && (t * 8) % 1 < 0.6;
      if (av === 'yawn') d.pose.eyesClosed = on;
      if (av === 'sneeze' && on && q > 0.3) { d.rot = -0.12; f.shake = Math.max(f.shake, 1); }
      if (av === 'clap') f.low.push((c) => { if (on && (t * 6) % 1 < 0.5) { pattern(c, d.x - 14, d.y - 26, PLUS, '#fff59d'); pattern(c, d.x + 12, d.y - 26, PLUS, '#fff59d'); } });
      if (av === 'laugh') { d.y -= on ? Math.abs(Math.sin(t * 14)) * 2 : 0; d.pose.mood = 'happy'; }
      if (av === 'sing') f.low.push((c) => { const z = (t * 0.8 + i * 0.4) % 1; pattern(c, d.x + 10 + z * 8, d.y - 30 - z * 14, NOTE, '#7e57c2'); });
      if (on && i === 0) {
        const txt = vd.sound ?? '';
        bubble(f, d.x + 6, d.y - 30 * d.scale, loud ? txt.toUpperCase() : quiet ? txt.toLowerCase() : txt, loud ? 44 : quiet ? 20 : 30, quiet ? 0.7 : 1);
        if (loud) f.shake = 2;
      }
      if (on && loud) f.low.push((c) => { for (let k = 1; k <= 3; k++) { R(c, d.x + 12 + k * 4, d.y - 22 - k * 2, 1, k * 4, '#ffffff'); } });
    } else if (motion === 'fall') {
      const thing = !LIVING.includes(spec.look);
      const at = 0.35 * W;
      d.x = (sp?.x ?? centerX) + spread(i); d.y = (sp?.y ?? G.ground) + lane;
      if (thing) {
        const p = clamp(ta / (0.35 * W / speedOf(g, spec)), 0, 1);
        d.y = lerp(-10, d.y, p * p);
        if (p >= 1) { const bounceT = ta - 0.35 * W / speedOf(g, spec); d.y -= Math.max(0, Math.sin(bounceT * 9) * 6 * Math.exp(-bounceT * 3)); }
      } else {
        const p = clamp((ta - at) / (0.35 / speedOf(g, spec)), 0, 1);
        if (ta < at) { d.x += ta * 8; d.pose.moving = true; d.pose.phase = ta * 1.6; }
        else d.x += at * 8;
        d.rot = (Math.PI / 2) * ease(p); d.pose.eyesClosed = p >= 1;
        if (p > 0.6) f.low.push((c) => { for (let k = 0; k < 3; k++) pattern(c, d.x - 14 + k * 12, d.y - 26 + ((t * 5 + k) % 2), PLUS, '#ffd54f'); });
        if (ta > at && ta < at + 0.6) f.low.push((c) => { for (let k = 0; k < 4; k++) R(c, d.x - 12 + k * 7, d.y - 2 - (ta - at) * 10, 3, 3, '#e0e0e0'); });
      }
    } else if (motion === 'object' && obj) {
      const mm = speedOf(g, spec);
      const objDraws = (x: number, y: number, extra: Partial<Draw> = {}) => g.object.slice(0, 3).map((o, k) => mkDraw(o, x + k * 12, y - k * 2, extra));
      if (av === 'chase') {
        const v = (verb === 'follow' ? 18 : 40) * mm;
        const r = pingpong(60, v * ta, 30 - EX * 0.6, 132 + EX * 0.6);
        const os = objDraws(r.x, G.ground + lane, { facing: r.facing });
        os.forEach((o) => { o.pose.moving = ta > 0; o.pose.phase = ta * 3 * mm; if (o.look === 'ball') o.rot = o.x / 6; });
        if (i === 0) os.forEach((o, k) => push(o, 10 + k, [], 1));
        d.x = r.x - r.facing * (26 + lag); d.facing = r.facing; d.pose.moving = ta > 0;
        d.y = G.ground + lane - i * 2;
      } else if (av === 'kick' || av === 'push') {
        const T = clamp((0.4 * W) / mm, 0.4, 0.8 * W);
        if (av === 'kick') {
          const p = clamp(ta / T, 0, 1);
          d.x = lerp(14, 80, p) - lag; d.pose.moving = p < 1;
          if (ta > T && ta < T + 0.3) d.rot = -0.2;
          if (i === 0) {
            const k = Math.max(0, ta - T);
            const ox = 92 + k * 70 * mm;
            const oy = G.ground - Math.max(0, Math.sin(Math.min(Math.PI, k * 2.2)) * 30);
            objDraws(ox, oy, { rot: k * 8 }).forEach((o, q) => push(o, 10 + q, [], 1));
            if (ta > T && ta < T + 0.5) f.low.push((c) => pattern(c, 88, G.ground - 14, BIGPLUS, '#ffd54f'));
          }
        } else {
          const p = clamp(ta / (0.2 * W), 0, 1);
          const pushX = Math.max(0, ta - 0.2 * W) * 14 * mm;
          const ox = Math.min(128, 56 + pushX);
          d.x = ta < 0.2 * W ? lerp(14, 42, p) - lag : ox - 14 - lag; d.pose.moving = ox < 128;
          if (i === 0) objDraws(ox, G.ground + lane, { rot: 0 }).forEach((o, q) => push(o, 10 + q, [], 1));
        }
        d.y = G.ground + lane - i * 2;
      } else if (av === 'eat') {
        const T = clamp((0.4 * W) / mm, 0.4, 0.7 * W);
        const p = clamp(ta / T, 0, 1);
        d.x = lerp(14, 78, p) - lag; d.pose.moving = p < 1; d.y = G.ground + lane - i * 2;
        const eatT = Math.max(0, ta - T);
        const left = clamp(1 - eatT / (2.4 / mm), 0, 1);
        if (p >= 1) { d.pose.mouthOpen = left > 0 && (t * 6) % 1 < 0.5; if (left === 0) d.pose.mood = 'happy'; }
        if (i === 0 && left > 0) {
          objDraws(94, G.ground + lane).forEach((o, q) => { o.scale *= Math.max(0.15, left); push(o, 10 + q, [], 1); });
          if (p >= 1) f.low.push((c) => { for (let k = 0; k < 3; k++) R(c, 88 + k * 4, G.ground - 2 - ((t * 7 + k) % 3), 1, 1, '#a1887f'); });
        }
        if (left === 0) f.low.push((c) => pattern(c, d.x - 2, d.y - 34 - ((t * 0.7) % 1) * 10, HEART, '#ff5c8a'));
      } else if (av === 'hug') {
        const T = clamp((0.45 * W) / mm, 0.4, 0.8 * W);
        const p = clamp(ta / T, 0, 1);
        d.x = lerp(14, 84, p) - lag; d.pose.moving = p < 1; d.y = G.ground + lane - i * 2;
        if (i === 0) {
          const os = objDraws(98, G.ground + lane, { facing: -1 });
          os.forEach((o) => { if (p >= 1) o.pose.mood = 'happy'; });
          os.forEach((o, q) => push(o, 10 + q, [], 1));
        }
        if (p >= 1) { d.pose.mood = 'happy'; f.low.push((c) => { for (let k = 0; k < 2; k++) { const q = (t * 0.8 + k / 2) % 1; pattern(c, 86 + k * 10, G.ground - 34 - q * 14, HEART, '#ff5c8a'); } }); }
      } else if (av === 'find') {
        const at = 0.5 * W / Math.max(0.6, mm);
        if (ta < at) { const r = pingpong(20, ta * 20 * mm, 16, 66); d.x = r.x - lag; d.facing = r.facing; d.pose.moving = true; }
        else { const p = clamp((ta - at) / 1.2, 0, 1); d.x = lerp(66, 80, p) - lag; d.facing = 1; d.pose.moving = p < 1; d.pose.mood = 'happy'; }
        d.y = G.ground + lane - i * 2;
        if (i === 0) {
          if (ta >= at) {
            const grow = clamp((ta - at) / 0.4, 0, 1);
            objDraws(98, G.ground + lane).forEach((o, q) => { o.scale *= grow; push(o, 10 + q, [], 1); });
            f.low.push((c) => { for (let k = 0; k < 4; k++) { if (((t * 3 + k * 0.3) % 1) < 0.5) pattern(c, 90 + ((k * 13) % 20), G.ground - 22 + ((k * 7) % 14), PLUS, '#fff59d'); } });
          }
          if (ta > at - 0.1 && ta < at + 1) bubble(f, d.x, d.y - 30 * d.scale, '!', 40);
        }
      }
    }

    if (spec.look === 'fish' && G.water && motion !== 'loco') { d.y = G.water.swim + lane; d.water = G.water.y; }
    if (happyAdv) { d.pose.mood = 'happy'; if (d.pose.moving) d.y -= Math.abs(Math.sin(t * 9)) * 2; }
    if (sadAdv) d.pose.mood = 'sad';
    if (quiet && i === 0 && motion !== 'sound' && ta > 0 && ta < 1.2) bubble(f, d.x, d.y - 30 * d.scale, 'shh', 20, 0.75);
    if (ph === 'behind' && sp?.behind && motion !== 'loco') d.behind = true;
    push(d, i, [...spec.adjs, ...extraAdjs], spec.intensity);
  });
}

const MOVING_PREPS_SET = new Set<string>(['to', 'into', 'over', 'across', 'through', 'up', 'from']);

function tag(h: Ctx, x: number, y: number, label: string) {
  const fam = getComputedStyle(document.documentElement).getPropertyValue('--lm-font') || 'sans-serif';
  h.save();
  h.font = `700 22px ${fam}`;
  const w = h.measureText(label).width + 18;
  const bx = clamp(x * HI - w / 2, 4 - EX * HI, (SW + EX) * HI - w - 4);
  const by = Math.max(4, y * HI - 40);
  h.fillStyle = label === 'ME' || label === 'YOU' ? '#fdd835' : '#ffffff';
  h.strokeStyle = '#1d1d27'; h.lineWidth = 3;
  roundRect(h, bx, by, w, 30, 15); h.fill(); h.stroke();
  h.fillStyle = '#1d1d27'; h.textAlign = 'center'; h.textBaseline = 'middle';
  h.fillText(label, bx + w / 2, by + 16);
  h.restore();
}

function roundRect(h: Ctx, x: number, y: number, w: number, hh: number, r: number) {
  h.beginPath();
  h.moveTo(x + r, y); h.arcTo(x + w, y, x + w, y + hh, r); h.arcTo(x + w, y + hh, x, y + hh, r); h.arcTo(x, y + hh, x, y, r); h.arcTo(x, y, x + w, y, r);
  h.closePath();
}

/* ---------------- Drawing a frame ---------------- */

let lowCanvas: HTMLCanvasElement | null = null;
function lowCtx(w: number): Ctx {
  if (!lowCanvas) { lowCanvas = document.createElement('canvas'); lowCanvas.height = SH; }
  if (lowCanvas.width !== w) lowCanvas.width = w;
  const c = lowCanvas.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  return c;
}

export interface Assets { tense: Record<Tense, HTMLImageElement>; symbols: Record<string, HTMLImageElement> }

const TENSE_LABEL: Record<Tense, string> = { past: 'Past', present: 'Present', future: 'Future' };

/** Draws the video for clip time t: 720 x 640 for the saved video, or 16:9 (1140 x 640) with wide on. */
export function drawScene(h: Ctx, clip: Clip | null, t: number, assets: Assets | null, idlePlace = 'meadow', wide = false) {
  EX = wide ? WIDE : 0;
  const BW = FW();
  const c = lowCtx(BW);
  const place = clip?.place ?? idlePlace;
  const f: Frame = { draws: [], low: [], hi: [], shake: 0, bush: false };
  if (clip) clip.a.groups.forEach((g, gi) => groupFrame(f, g, gi, clip, t));
  const sx = f.shake ? Math.round(Math.sin(t * 70) * f.shake) : 0;
  c.save();
  c.clearRect(0, 0, BW, SH);
  c.translate(sx + EX, 0);
  drawBackground(c, place, t);
  if (f.bush) occluder(c, 'meadow', true);
  const behind = f.draws.filter((d) => d.behind);
  const front = f.draws.filter((d) => !d.behind).sort((a, b) => a.y - b.y);
  behind.forEach((d) => blit(c, d));
  if (behind.length) occluder(c, place, f.bush);
  front.forEach((d) => blit(c, d));
  if (place === 'forest') { R(c, 2 - EX, 70, 7, 58, '#4e342e'); R(c, SW + EX - 10, 66, 8, 62, '#4e342e'); }
  f.low.forEach((fn) => fn(c));
  c.restore();

  // Past looks like an old photo; future looks like a daydream.
  const tense = clip?.a.tense;
  if (tense === 'past') {
    c.save();
    c.globalCompositeOperation = 'saturation'; c.globalAlpha = 0.85; c.fillStyle = '#808080'; c.fillRect(0, 0, BW, SH);
    c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.55; c.fillStyle = '#e8c99a'; c.fillRect(0, 0, BW, SH);
    c.restore();
  } else if (tense === 'future') {
    c.save();
    c.globalCompositeOperation = 'soft-light'; c.globalAlpha = 0.6; c.fillStyle = '#7c6cff'; c.fillRect(0, 0, BW, SH);
    c.restore();
    for (let k = 0; k < 7; k++) { const q = (t * 0.25 + k / 7) % 1; if (((t * 2 + k) % 1) < 0.6) pattern(c, (k * 37 + Math.floor(k / 4) * 61) % (BW - 6), SH - q * SH, PLUS, '#ffffff'); }
  }

  h.save();
  h.imageSmoothingEnabled = false;
  h.clearRect(0, 0, BW * HI, SH * HI);
  h.drawImage(lowCanvas!, 0, 0, BW, SH, 0, 0, BW * HI, SH * HI);
  if (tense === 'past') {
    const g = h.createRadialGradient(BW * HI / 2, SH * HI / 2, SH * HI * 0.35, BW * HI / 2, SH * HI / 2, BW * HI * 0.6);
    g.addColorStop(0, 'rgba(60,40,20,0)'); g.addColorStop(1, 'rgba(60,40,20,0.45)');
    h.fillStyle = g; h.fillRect(0, 0, BW * HI, SH * HI);
  }
  if (tense === 'future') {
    h.strokeStyle = 'rgba(255,255,255,0.85)'; h.lineWidth = 8; h.setLineDash([26, 18]);
    roundRect(h, 14, 14, BW * HI - 28, SH * HI - 28, 30); h.stroke(); h.setLineDash([]);
  }
  h.save();
  h.translate(EX * HI, 0);
  f.hi.forEach((fn) => fn(h));
  if (clip?.a.intj && t < 1.6) burst(h, clip.a.intj, t);
  h.restore();
  if (tense && assets) tenseBadge(h, tense, assets);
  h.restore();
}

function burst(h: Ctx, word: string, t: number) {
  const fam = getComputedStyle(document.documentElement).getPropertyValue('--lm-font') || 'sans-serif';
  const p = clamp(t / 0.25, 0, 1);
  const fade = clamp((1.6 - t) / 0.3, 0, 1);
  const cx = SW * HI / 2; const cy = 170;
  h.save();
  h.globalAlpha = fade;
  h.translate(cx, cy); h.scale(0.4 + 0.6 * ease(p), 0.4 + 0.6 * ease(p)); h.rotate(-0.06);
  h.beginPath();
  for (let i = 0; i < 24; i++) { const r = i % 2 ? 120 : 175; const a = (i / 24) * Math.PI * 2; h.lineTo(Math.cos(a) * r * 1.5, Math.sin(a) * r * 0.8); }
  h.closePath();
  h.fillStyle = '#ffeb3b'; h.strokeStyle = '#1d1d27'; h.lineWidth = 8; h.fill(); h.stroke();
  h.font = `800 92px ${fam}`; h.textAlign = 'center'; h.textBaseline = 'middle';
  h.lineWidth = 10; h.strokeStyle = '#ffffff'; h.strokeText(`${word}!`, 0, 6);
  h.fillStyle = '#e8590c'; h.fillText(`${word}!`, 0, 6);
  h.restore();
}

function tenseBadge(h: Ctx, tense: Tense, assets: Assets) {
  const fam = getComputedStyle(document.documentElement).getPropertyValue('--lm-font') || 'sans-serif';
  h.save();
  h.font = `700 30px ${fam}`;
  const label = TENSE_LABEL[tense];
  const w = 70 + h.measureText(label).width + 22;
  h.fillStyle = 'rgba(255,255,255,0.95)'; h.strokeStyle = '#1d1d27'; h.lineWidth = 3;
  roundRect(h, 18, 18, w, 64, 32); h.fill(); h.stroke();
  const img = assets.tense[tense];
  if (img.complete && img.naturalWidth) h.drawImage(img, 28, 24, 52, 52);
  h.fillStyle = '#1d1d27'; h.textBaseline = 'middle';
  h.fillText(label, 88, 51);
  h.restore();
}

/* ---------------- The saved video: video on top, the sentence with her symbols below ---------------- */

export const EXPORT_W = SW * HI;
export const EXPORT_H = EXPORT_W * 16 / 9;

const CLASS_COLOR: Record<string, string> = {
  noun: '#D02028', propernoun: '#D02028', article: '#F7B3CF', adjective: '#48B8E0', verb: '#40A870', preposition: '#703818',
  adverb: '#1868A8', pronoun: '#E0D000', conjunction: '#9870B8', interjection: '#F87220',
};

export function drawExportFrame(h: Ctx, clip: Clip, t: number, assets: Assets, index: number, total: number, code: string | null) {
  h.save();
  drawScene(h, clip, t, assets);
  h.restore();
  const top = SH * HI;
  const W = EXPORT_W;
  const H = EXPORT_H - top;
  const fam = getComputedStyle(document.documentElement).getPropertyValue('--lm-font') || 'sans-serif';
  const g = h.createLinearGradient(0, top, 0, EXPORT_H);
  g.addColorStop(0, '#fdf9e1'); g.addColorStop(1, '#e8f4f8');
  h.fillStyle = g; h.fillRect(0, top, W, H);
  h.fillStyle = '#1968AB'; h.fillRect(0, top, W, 8);

  // Formula code and sentence number.
  h.font = `700 26px ${fam}`; h.textBaseline = 'middle';
  if (code) {
    const cw = h.measureText(code).width + 32;
    h.fillStyle = '#1968AB'; roundRect(h, 32, top + 34, cw, 46, 23); h.fill();
    h.fillStyle = '#ffffff'; h.fillText(code, 48, top + 58);
  }
  h.fillStyle = '#4A5D70'; h.textAlign = 'right';
  h.fillText(`${index + 1} of ${total}`, W - 32, top + 58);
  h.textAlign = 'left';

  // Words with symbols, wrapped.
  const active = wordAt(t, clip.words.length);
  const size = clip.words.length > 9 ? 40 : 48;
  h.font = `700 ${size}px ${fam}`;
  const sym = size * 1.25;
  const gap = 18;
  const lines: { w: Word; width: number; i: number }[][] = [[]];
  let lineW = 0;
  clip.words.forEach((w, i) => {
    const width = Math.max(h.measureText(w.text).width, sym);
    if (lineW + width > W - 64 && lines[lines.length - 1].length) { lines.push([]); lineW = 0; }
    lines[lines.length - 1].push({ w, width, i });
    lineW += width + gap;
  });
  const lineH = sym + size + 44;
  let y = top + 120 + Math.max(0, (H - 200 - lines.length * lineH) / 2);
  for (const line of lines) {
    const total2 = line.reduce((s, x) => s + x.width, 0) + gap * (line.length - 1);
    let x = (W - total2) / 2;
    for (const { w, width, i } of line) {
      const on = i === active;
      if (on) { h.fillStyle = '#FBF2BB'; roundRect(h, x - 10, y - 8, width + 20, lineH - 16, 18); h.fill(); h.strokeStyle = '#E9C84A'; h.lineWidth = 3; h.stroke(); }
      const img = assets.symbols[w.cls];
      if (img?.complete && img.naturalWidth) h.drawImage(img, x + (width - sym) / 2, y, sym, sym);
      if (w.tense) {
        const ti = assets.tense[w.tense];
        if (ti.complete && ti.naturalWidth) h.drawImage(ti, x + (width + sym) / 2 - sym * 0.35, y - sym * 0.25, sym * 0.55, sym * 0.55);
      }
      h.fillStyle = '#0F2B45'; h.textBaseline = 'alphabetic';
      h.fillText(w.text, x + (width - h.measureText(w.text).width) / 2, y + sym + size + 6);
      h.fillStyle = CLASS_COLOR[w.cls] ?? '#0F2B45';
      h.fillRect(x + 4, y + sym + size + 16, width - 8, 6);
      x += width + gap;
    }
    y += lineH;
  }

  h.font = `600 22px ${fam}`; h.fillStyle = '#6B7C8C'; h.textAlign = 'center'; h.textBaseline = 'middle';
  h.fillText('Story Maker · Literacy Manipulatives', W / 2, EXPORT_H - 34);
  h.textAlign = 'left';
}
