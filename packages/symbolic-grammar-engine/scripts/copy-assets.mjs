// Copies the engine's word lists and grammar symbol pictures into an app's public folder, where the engine loads
// them in the browser (configureEngine's dataUrl, default /writer; symbols at /literacy/grammar-symbols).
// Usage: node <engine>/scripts/copy-assets.mjs <app public folder>
import fs from 'node:fs';
import path from 'node:path';
const here = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const pub = process.argv[2];
if (!pub) { console.error('Usage: node scripts/copy-assets.mjs <public folder>'); process.exit(1); }
const copyDir = (from, to) => {
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) fs.copyFileSync(path.join(from, f), path.join(to, f));
};
copyDir(path.join(here, 'data'), path.join(pub, 'writer'));
copyDir(path.join(here, 'assets', 'grammar-symbols'), path.join(pub, 'literacy', 'grammar-symbols'));
console.log('Symbolic Grammar Engine: word lists and symbols copied to', pub);
