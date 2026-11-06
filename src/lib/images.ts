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
