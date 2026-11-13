# Symbolic Grammar Engine

One grammar engine for every Symbolic Grammar and Literacy Manipulatives project: the grammar symbol for every word,
sentence formulas, and her formula codes. The rules are in [RULES.md](RULES.md).

Used by: Literacy Manipulatives (Whiteboard, Word Processor, Word Explorer, Word List Maker, Formula Search, Daily
Procedure) and the independent work dashboard.

## Use it in a project

1. Install it (pin a version so every project uses the same rules):
   `npm install github:vermontliteracynetwork/symbolic-grammar-engine#v1.0.0`
2. Copy its word lists and symbol pictures into the app's public folder (add this to `predev` and `prebuild`):
   `node node_modules/symbolic-grammar-engine/scripts/copy-assets.mjs public`
3. Use it:

```ts
import { loadEngine, readText, fitsJob, formulaCode, sentenceSlots, GRAMMAR_SYMBOL_INFO } from 'symbolic-grammar-engine';

await loadEngine();                       // loads the word lists (from /writer by default)
readText('A dog sees the plant.');         // each word with its symbol: article, noun, verb, article, noun
fitsJob('happy', 'verb');                  // 'no' (happy is an adjective)
```

The engine is TypeScript source; a Vite (or any TypeScript) app uses it as it is. A Node script passes its own file
loader: `configureEngine({ loadJson: (name) => ... })` (see `test/run.ts`).

## Check it

`npm test` runs every check (80 test sentences, her 121 formulas, her 118 formula cards, every shared fix) and fails
if anything is wrong. GitHub runs it on every change.

## Share teacher fixes

A teacher's fixes from Formula Search ("Send my fixes to the engine") are added with
`npm run add-fixes <downloaded file>`, then `npm test`. Every project that updates to the new version gets them.

## Data and licenses

- `data/pos.json`: parts of speech from Princeton WordNet 3.0 (`data/WORDNET-LICENSE.txt`).
- `data/words.json`: SCOWL word lists (`data/WORDLIST-COPYRIGHT.txt`).
- `assets/grammar-symbols/`: her grammar symbol pictures (owned).
- Formula list and formula codes: her Symbolic Grammar materials (owned).
