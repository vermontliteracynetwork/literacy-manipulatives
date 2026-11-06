// Pictures inserted on the whiteboard (her request 2026-11-06: "add a way to insert a saved image that should be
// moveable around the whiteboard screen. can add multiple images"). A picture is made small on the way in (at most
// 1000 px on its long side), so a board with a few pictures still saves and still travels to students' screens.

const MAX_SIDE = 1000;
// The size a new picture first shows at on the board, before it is resized.
const FIRST_SIDE = 280;

export interface BoardImage { src: string; w: number; h: number }

const load = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('not a picture'));
  img.src = url;
});

export async function shrinkImage(file: File): Promise<BoardImage> {
  const url = URL.createObjectURL(file);
  try {
    const img = await load(url);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const cw = Math.max(1, Math.round(img.naturalWidth * scale));
    const ch = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    canvas.getContext('2d')?.drawImage(img, 0, 0, cw, ch);
    // WebP keeps see-through backgrounds and stays small; a browser that can't write WebP gets PNG for a PNG
    // (to keep see-through parts) and JPEG for a photo.
    let src = canvas.toDataURL('image/webp', 0.82);
    if (!src.startsWith('data:image/webp')) src = file.type === 'image/png' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85);
    const first = Math.min(1, FIRST_SIDE / Math.max(cw, ch));
    return { src, w: Math.round(cw * first), h: Math.round(ch * first) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Crop a picture to part of itself (her request 2026-11-06), given as fractions of its width and height.
export async function cropImage(src: string, l: number, t: number, r: number, b: number): Promise<string> {
  const img = await load(src);
  const sx = Math.round(l * img.naturalWidth), sy = Math.round(t * img.naturalHeight);
  const sw = Math.max(1, Math.round((r - l) * img.naturalWidth)), sh = Math.max(1, Math.round((b - t) * img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  canvas.getContext('2d')?.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  const out = canvas.toDataURL('image/webp', 0.85);
  return out.startsWith('data:image/webp') ? out : canvas.toDataURL('image/png');
}

// "My pictures": the last few pictures inserted on this device, kept in the Insert tray to drag out again.
const KEY = 'lm-my-images';
const KEEP = 8;
export function readMyImages(): BoardImage[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((x) => typeof x?.src === 'string' && x.src.startsWith('data:image/')) : [];
  } catch {
    return [];
  }
}
export function saveMyImages(list: BoardImage[]): BoardImage[] {
  const shown = list.slice(0, KEEP);
  // Browser storage is small: save as many of the newest as fit (the tray still shows all of them this visit).
  for (let n = shown.length; n >= 0; n--) {
    try { if (n) localStorage.setItem(KEY, JSON.stringify(shown.slice(0, n))); else localStorage.removeItem(KEY); break; } catch { /* too big: try fewer */ }
  }
  return shown;
}
