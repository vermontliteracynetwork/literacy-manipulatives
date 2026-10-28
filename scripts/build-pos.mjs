// Builds public/writer/pos.json: for every word in the Write mode word list (public/writer/words.json), the jobs
// a dictionary lists for it, most common first (her note 2026-10-28: step 1 of choosing a symbol is "what is
// the word listed as in the dictionary?"). Source: WordNet 3.0 (Princeton; license in
// public/writer/WORDNET-LICENSE.txt), where each sense's tag count (how often it was seen in tagged text)
// orders noun, verb, adjective and adverb. Word forms WordNet doesn't list (dogs, ran, taller) take the jobs
// of their base word.
//
// Usage: node scripts/build-pos.mjs <path to WordNet dict folder>   (e.g. from the npm package wordnet-db)
import fs from 'node:fs';
import path from 'node:path';

const dict = process.argv[2];
if (!dict) { console.error('Usage: node scripts/build-pos.mjs <wordnet dict folder>'); process.exit(1); }
const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const words = JSON.parse(fs.readFileSync(path.join(root, 'public/writer/words.json'), 'utf8')).flat();

// lemma -> { n, v, a, r } summed tag counts (+1 per sense so untagged senses still count a little)
const TYPE = { 1: 'n', 2: 'v', 3: 'a', 4: 'r', 5: 'a' };
const counts = new Map();
for (const line of fs.readFileSync(path.join(dict, 'index.sense'), 'utf8').split('\n')) {
  const m = line.match(/^([^%]+)%(\d):\S*\s+\S+\s+\S+\s+(\d+)/);
  if (!m) continue;
  const lemma = m[1].replace(/_/g, ' ');
  if (lemma.includes(' ')) continue;
  const c = counts.get(lemma) ?? { n: 0, v: 0, a: 0, r: 0 };
  c[TYPE[m[2]]] += Number(m[3]) * 4 + 1;
  counts.set(lemma, c);
}

const IRREGULAR_VERB = 'was were been am is are had did done went gone came saw seen got gotten made took taken gave given said told knew known thought felt ran ate eaten drank drunk slept sat stood swam swum flew flown wrote written drew drawn sang sung rode ridden threw thrown caught found kept built brought bought sold wore worn held hid hidden fell fallen grew grown taught won lost left met paid sent spent woke woken dug fought began begun broke broken chose chosen drove driven forgot forgotten heard spoke spoken stole stolen led lay laid shook shaken shone shot sank sunk slid spun stuck stung struck swung tore torn understood bit bitten blew blown fed froze frozen hung rang rung rose risen sought swept lent meant bled crept fled knelt'.split(' ');
const IRREGULAR_PLURAL = 'children men women people feet teeth mice geese oxen'.split(' ');
const get = (w) => counts.get(w);
function jobs(w) {
  const total = { n: 0, v: 0, a: 0, r: 0 };
  const add = (c, only) => { if (!c) return; for (const k of only ?? 'nvar') total[k] += c[k] ?? 0; };
  add(get(w));
  if (IRREGULAR_VERB.includes(w)) total.v += 50;
  if (IRREGULAR_PLURAL.includes(w)) total.n += 50;
  // -s / -es / -ies: a plural noun or a verb that goes with one
  for (const base of [w.replace(/ies$/, 'y'), w.replace(/es$/, ''), w.replace(/s$/, '')]) {
    if (base !== w && /s$/.test(w) && get(base)) { add(get(base), 'nv'); break; }
  }
  // -ed / -ing: a verb (and sometimes a describing word, which WordNet lists on its own)
  if (/(ed|ing)$/.test(w)) {
    const stem = w.replace(/(ed|ing)$/, '');
    for (const base of [stem, `${stem}e`, stem.replace(/i$/, 'y'), stem.replace(/(.)\1$/, '$1')]) if (base.length >= 3 && get(base)?.v) { total.v += get(base).v; break; }
  }
  // -er / -est: a describing word that compares
  if (/(er|est)$/.test(w)) {
    const stem = w.replace(/(er|est)$/, '');
    for (const base of [stem, `${stem}e`, stem.replace(/i$/, 'y'), stem.replace(/(.)\1$/, '$1')]) if (base.length >= 3 && get(base)?.a) { total.a += get(base).a; break; }
  }
  // -ly: a how word
  if (/ly$/.test(w) && !get(w)) total.r += 1;
  // Jobs that are rare for this word (under 6% of its most common job: "cat" as a verb) are marked with a
  // capital letter: the sentence around the word can still choose them ("a kind dog"), but spell check doesn't
  // count them when asking whether a word fits its spot ("I will cat the ball").
  const top = Math.max(...Object.values(total));
  return Object.entries(total).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([k, n]) => (n >= top * 0.06 ? k : k.toUpperCase())).join('');
}

const out = {};
let n = 0;
for (const w of new Set(words.map((x) => x.toLowerCase()))) {
  const j = jobs(w);
  if (!j) continue;
  (out[j] ??= []).push(w);
  n++;
}
const json = Object.fromEntries(Object.entries(out).map(([k, list]) => [k, list.join(' ')]));
fs.writeFileSync(path.join(root, 'public/writer/pos.json'), JSON.stringify(json));
fs.copyFileSync(path.join(dict, '..', 'LICENSE'), path.join(root, 'public/writer/WORDNET-LICENSE.txt'));
console.log(`${n} words with dictionary jobs`);
