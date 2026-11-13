// Text rules check for Word Explorer (build spec Phase 1 checks): no em dashes in any student or teacher string.
// Scans Word Explorer's code and data. Run with `npm run check-text` (also part of `npm run lint`).
import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const TARGETS = ['src/components/word-explorer', 'src/lib/word-explorer', 'src/components/MainMenu.tsx', 'src/components/FormulaSearch.tsx', 'src/components/PassageBuilder.tsx', 'src/components/passageBuilder.css', 'src/lib/writer/corrections.ts', 'src/lib/writer/practice.ts', 'src/components/formulaSearch.css', 'public/word-explorer'];
const BAD = [['—', 'em dash']];
let problems = 0;
function scan(file) {
  const text = fs.readFileSync(file, 'utf8');
  text.split('\n').forEach((line, i) => {
    for (const [ch, name] of BAD) {
      if (line.includes(ch)) {
        problems++;
        if (problems <= 50) console.error(`${path.relative(root, file)}:${i + 1}: ${name}: ${line.trim().slice(0, 120)}`);
      }
    }
  });
}
function walk(p) {
  const full = path.join(root, p);
  if (!fs.existsSync(full)) return;
  if (fs.statSync(full).isDirectory()) for (const f of fs.readdirSync(full)) walk(path.join(p, f));
  else if (/\.(tsx?|css|json|txt|md)$/.test(full)) scan(full);
}
TARGETS.forEach(walk);
if (problems) { console.error(`${problems} text problem(s). Her rule: no em dashes anywhere.`); process.exit(1); }
console.log('Text check passed: no em dashes in Word Explorer.');
