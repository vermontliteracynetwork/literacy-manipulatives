# Literacy Manipulatives (standalone)

A standalone, open-canvas literacy tool: grammar symbols, morphemes, symbol
sentences, punctuation, word chains, heart words, spelling rules, sentence
formulas, and a draw/text layer, all on one drag-and-drop board.

Ported from the "Literacy Manipulatives" tool inside the Homeplot classroom
dashboard (a private, student-facing app). This is a from-scratch copy, not
a shared package — the dashboard's own copy is untouched and unaffected by
anything in this repo.

## v1 scope: no login, nothing saved

This version has **no accounts and no save/load** on purpose:

- Every tool is unlocked for anyone who opens the page — no free/paid split
  yet.
- Nothing persists between visits. Reloading the page clears the board.
- Text-to-speech (the 🔈 buttons) uses the browser's own built-in voices —
  no purchased "voice skins."

Accounts, saving, and a free/paid split are a deliberately later phase, not
missing pieces of this one.

## What was left out of the port, and why

The dashboard's version ties a few things to a signed-in student's account.
None of that applies here, so it's gone rather than stubbed out:

- **Help overlay** and **Exit-to-home confirm** — both assume a student
  account and a "home" screen to return to.
- **Save/My Boards** — the dashboard's per-student saved-whiteboard list.
- **Word Lists category** — a teacher-curated "Literacy Focus" word set,
  per student.
- **Marketplace-purchased voice skins and marker/highlight colors** — this
  version just gives everyone the full base color palette instead.
- **Per-student "show punctuation tiles" toggle** — always on here.

## Developing

```bash
npm install
npm run dev
```

`npm run build` type-checks and produces a production build in `dist/`.

## Deploying

Deployed via Vercel, auto-building on every push to `main`. No environment
variables are required for this v1 (no backend, no accounts).
