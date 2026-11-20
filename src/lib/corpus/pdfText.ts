// Text out of a PDF for Mark up a passage (her request 2026-11-20). Each page's words are put back into lines by their
// height on the page, a line that wraps is joined to the next, and what repeats on most pages (running headers,
// footers) and bare page numbers are left out, so they do not show up as sentences. A scanned PDF has no text in it;
// it needs text recognition first, so it is reported, not guessed at.

interface Item { str: string; x: number; y: number; h: number }

export interface PdfResult { text: string; pages: number; scanned: boolean; removed: number }

const PAGE_NUMBER = /^\s*(page\s*)?\d{1,4}(\s*(of|\/)\s*\d{1,4})?\s*$/i;
const ENDS = /[.!?:;"”’)]$/;

export async function pdfText(file: File): Promise<PdfResult> {
  const pdfjs = await import('pdfjs-dist');
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items: Item[] = [];
    for (const it of content.items) {
      if (!('str' in it) || !it.str.trim()) continue;
      items.push({ str: it.str, x: it.transform[4], y: it.transform[5], h: Math.abs(it.transform[3]) || it.height || 10 });
    }
    pages.push(toLines(items));
  }
  const words = pages.flat().join(' ').trim();
  if (!words) return { text: '', pages: doc.numPages, scanned: true, removed: 0 };
  // Lines that repeat on half or more of the pages (with numbers ignored) are running headers or footers.
  const key = (l: string) => l.toLowerCase().replace(/\d+/g, '#').trim();
  const seen = new Map<string, number>();
  for (const lines of pages) for (const k of new Set(lines.filter((l) => l).map(key))) seen.set(k, (seen.get(k) ?? 0) + 1);
  let removed = 0;
  const keep = (l: string) => {
    if (!l) return true;
    if (PAGE_NUMBER.test(l) || (pages.length >= 3 && (seen.get(key(l)) ?? 0) >= Math.ceil(pages.length / 2))) { removed++; return false; }
    return true;
  };
  const text = pages.map((lines) => joinWrapped(lines.filter(keep)).join('\n')).join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  return { text, pages: doc.numPages, scanned: false, removed };
}

// Words at the same height are one line, read left to right; a bigger gap than usual between lines starts a new paragraph.
function toLines(items: Item[]): string[] {
  const rows: { y: number; h: number; parts: Item[] }[] = [];
  for (const it of items.sort((a, b) => b.y - a.y || a.x - b.x)) {
    const row = rows.find((r) => Math.abs(r.y - it.y) < Math.max(2, it.h * 0.4));
    if (row) row.parts.push(it); else rows.push({ y: it.y, h: it.h, parts: [it] });
  }
  rows.sort((a, b) => b.y - a.y);
  const gaps = rows.slice(1).map((r, i) => rows[i].y - r.y).sort((a, b) => a - b);
  const usual = gaps[Math.floor(gaps.length / 2)] ?? 0;
  const out: string[] = [];
  rows.forEach((r, i) => {
    if (i > 0 && usual && rows[i - 1].y - r.y > usual * 1.6) out.push('');
    out.push(r.parts.sort((a, b) => a.x - b.x).map((p) => p.str).join(' ').replace(/\s+/g, ' ').trim());
  });
  return out;
}

// A line that runs on (no end mark, next line starts lowercase, or the line is long) joins the next one; a word split
// with a hyphen at the end of a line is put back together.
function joinWrapped(lines: string[]): string[] {
  const out: string[] = [];
  for (const l of lines) {
    const prev = out[out.length - 1];
    if (prev && l && !ENDS.test(prev) && (/^[a-z]/.test(l) || prev.length > 55)) {
      out[out.length - 1] = /[a-z]-$/.test(prev) ? prev.slice(0, -1) + l : `${prev} ${l}`;
    } else out.push(l);
  }
  return out;
}
