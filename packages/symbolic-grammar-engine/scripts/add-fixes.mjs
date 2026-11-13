// Adds a teacher's fixes to the shared fixes every project uses (data/teacher-fixes.json).
// The file comes from Formula Search's passage tab: "Download the formula base" (or "Send my fixes to the engine").
// Usage (in this package): node scripts/add-fixes.mjs <downloaded file.json> [more files...]
// Then run npm test: every shared fix becomes a check the engine must keep passing.
import fs from 'node:fs';
import path from 'node:path';
const here = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const target = path.join(here, 'data', 'teacher-fixes.json');
const files = process.argv.slice(2);
if (!files.length) { console.error('Usage: node scripts/add-fixes.mjs <file.json> [...]'); process.exit(1); }
const shared = JSON.parse(fs.readFileSync(target, 'utf8'));
const key = (c) => JSON.stringify([c.sentence, c.word, c.prev, c.next]);
const byKey = new Map(shared.map((c) => [key(c), c]));
let added = 0, changed = 0;
for (const f of files) {
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  const list = Array.isArray(d) ? d : d.corrections ?? [];
  for (const c of list) {
    if (!c || !c.word || !c.sentence || !c.to) continue;
    const k = key(c);
    if (!byKey.has(k)) added++; else if (byKey.get(k).to !== c.to) changed++;
    byKey.set(k, { word: c.word, prev: c.prev ?? '', next: c.next ?? '', to: c.to, from: c.from, sentence: c.sentence, at: c.at });
  }
}
fs.writeFileSync(target, JSON.stringify([...byKey.values()], null, 1) + '\n');
console.log(`Shared fixes: ${added} added, ${changed} changed, ${byKey.size} in all. Now run npm test.`);
