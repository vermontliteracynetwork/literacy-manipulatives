// Runs every engine check in Node: the hand-checked test sentences (every word's symbol), her whole formula list
// (every code), and every shared fix in data/teacher-fixes.json. Exits with an error if anything is wrong, so a
// change that breaks the engine cannot be merged. Run: npm test (in this package).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { configureEngine, loadEngine, checkEngine, sharedCorrections, tagEngine, tagForCheck as tagFixed } from '../src/index';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'data');
configureEngine({ loadJson: async (name) => JSON.parse(readFileSync(join(dataDir, name), 'utf8')) });

await loadEngine();
const r = checkEngine();
let failed = 0;
console.log(`Symbols: ${r.tags.pass} of ${r.tags.total} test sentences right word for word.`);
for (const m of r.tags.misses) { failed++; console.log(`  WRONG  ${m.sentence}\n         engine: ${m.got.join(' ')}\n         should: ${m.expect.join(' ')}`); }
console.log(`Formula codes: ${r.codes.pass} of ${r.codes.total} examples in her list coded right.`);
for (const m of r.codes.misses) { failed++; console.log(`  WRONG  ${m.sentence}  engine: ${m.got}  her list: ${m.expect}`); }
console.log(`Formula cards: ${r.cards.pass} of ${r.cards.total} model sentences match their own card.`);
for (const m of r.cards.misses) { failed++; console.log(`  WRONG  card ${m.lesson}: ${m.sentence}`); }
// Every shared fix must hold (with the fixes applied, the fixed word gets the fixed symbol).
const fixes = sharedCorrections();
const tagForCheck = tagFixed;
let fixesOk = 0;
for (const c of fixes) {
  const words = tagForCheck(c.sentence);
  const i = words.findIndex((w, k) => w.word.toLowerCase() === c.word && (words[k - 1]?.word.toLowerCase() ?? '') === c.prev && (words[k + 1]?.word.toLowerCase() ?? '') === c.next);
  if (i >= 0 && words[i].wordClass === c.to) fixesOk++;
  else { failed++; console.log(`  WRONG  shared fix "${c.word}" in "${c.sentence}" should be ${c.to}`); }
}
console.log(`Shared fixes: ${fixesOk} of ${fixes.length} hold.`);
void tagEngine;
if (failed) { console.log(`\n${failed} problem(s). Fix the rule (or the test, if the test is wrong) before merging.`); process.exit(1); }
console.log('\nAll engine checks passed.');
