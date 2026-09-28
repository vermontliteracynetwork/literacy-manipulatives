# Literacy Manipulatives — Development Log

This is the full history of this tool: everything built while it lived
inside the Homeplot classroom dashboard (private, student-facing app,
repo `vermontliteracynetwork/dashboard`), why it was spun out into this
standalone repo, exactly what came with it and what didn't, and what's
still ahead. Written so a fresh conversation about this project has full
context without digging through another repo's history.

---

## Part 1 — History inside the dashboard (`GrammarSandbox.tsx`)

### Origin and the redesign that set the current shape

The tool was originally built as a scripted, activity-based mode-switcher
(Mad Libs, target-word Sound Boxes, fixed Word Sorts, a tap-to-attach
Morpheme Web, a Montessori decision-tree Sentence Builder). The teacher
rejected that version outright after seeing it live:

> "the literacy manipulatives is just not up to par... the design of the
> literacy manipulatives is too scripted, too prompted. it should really
> just be a drag and drop... an interactive whiteboard to explore all the
> tools... entirely unscripted and not aligned with a curriculum... this
> is open play, dont build the activity component until all design,
> features, navigation, and tools in literacy manipulatives is developed
> completely."

That's the standing design principle this whole tool is built around:
**one open, unscripted whiteboard. No modes, no lessons, no scoring, no
completion state, nothing gated.** It's a thinking-and-building space —
the digital equivalent of physical letter tiles, grammar boxes, and
word-building materials in a Montessori-style literacy classroom — not
an assessment.

### The full feature set as it shipped (16 sidebar categories)

1. **Grammar Symbols** — 9 real Montessori shape+color symbols (teacher-
   designed art) as blank draggable objects; hover/focus shows the part-
   of-speech name and a plain-language definition.
2. **Symbol Sentences** — 33 real Montessori grammar-box sentences
   (teacher-uploaded deck), symbol-only preview cards, drag drops the
   whole sentence as a unit.
3. **Morphemes** — root/prefix/suffix jigsaw pieces that only visually
   snap together when they spell a real word, with a definition card
   (read aloud), a join-rule badge when a spelling rule applies
   (e-drop/consonant-doubling), and faint "Word Web" connector lines. Two
   related tools live here: **Word Matrix** (pick a root, see every
   prefix/suffix against it) and **Reverse Morphology** (drag a real word
   as a "can you build this?" prompt).
4. **Alphabet** — full A-Z tiles, both cases (double-tap flips case);
   optional vowel/consonant coloring.
5. **Graphemes** — the full multi-letter English grapheme set in 6 hand-
   specified categories; split-vowel connector styling (e.g. "a_e" shows
   a connector arc between the two vowel letters). *Not verified against
   UFLI's specific published scope-and-sequence — see Part 3.*
6. **Punctuation** *(opt-in, teacher-toggled per student in the
   dashboard)* — 10 marks with hover definitions.
7. **Phonological Awareness** — Sound Chips (blank segmenting counters),
   an Onset-Rime Divider bar, and a Syllable Tapper (type/speak a word,
   tap once per clap, self-counted, never auto-graded).
8. **Sound Boxes** — 1-8 box frames (flexible count), letters/graphemes
   snap into cells, multi-letter graphemes fill one cell as a unit.
9. **Text Box** — typed/spoken free text, double-tap to edit, resizable
   text (A-/A+, 12-48px).
10. **Sentence Formulas** — a real 22-formula bank as fixed-position
    canvas cards. Each blank: type, speak, or pick from an alphabetized/
    searchable dropdown. Once complete: capitalized sentence display with
    live word-highlighting, a calm (never "wrong") grammar+capitalization
    check, "Add to paragraph," and cards can be joined into a paragraph
    chain.
11. **Word Chains** — 5 real one-letter-swap word ladders.
12. **Heart Words** — 20 real high-frequency words; drag one out, then
    tap its letters to mark the tricky part yourself (never auto-marked).
13. **Spelling Rules** — 8 ordinary English spelling-rule reference cards.
14. **Dictation** — hear a word (manually chosen, never randomized), type
    what you heard, reveal to self-check (never auto-graded).
15. **Writing Scaffolds** — 6 Writing Frames (fixed starter phrases +
    blanks) and 14 plain Sentence Starters.
16. **Word Lists** *(dashboard-only — shown when the signed-in student
    has an active teacher-set "Literacy Focus")* — a read-only reference
    word list, tap-to-hear, draggable. **This category did not come with
    the standalone port** — see Part 2.

### Accessibility/accommodation layer (all shipped, all opt-in where relevant)

- **TTS with synced word-highlighting**, one shared engine
  (`SyncedSpeakButton.tsx` / `useSyncedTTS()`) — every read-aloud control
  on the screen goes through one hook so only one utterance ever plays at
  once, and the spoken word highlights live wherever the visible and
  spoken text match exactly. Degrades gracefully where a browser doesn't
  fire word-boundary events — it still reads aloud, it just won't
  highlight.
- **Speech-to-text**, scoped and deliberate — a microphone button (with a
  listening chime and visual state) on every free-text field, browser
  `SpeechRecognition`.
- **Spelling support in every dropdown** — word-bank pickers are
  alphabetized and filter live by prefix, so a student who only knows the
  first letter or two can still find a word without needing to spell it.
- **A shared reference-popover pattern** — one component, two modes (a
  hover/focus tooltip; an inline card with its own read-aloud), so every
  reference fact on the screen looks and behaves the same way.
- **Non-punitive feedback everywhere.** Wrong morpheme combinations just
  don't connect — no shake, no error sound, no red X. Heart Words and the
  Syllable Tapper are entirely self-directed; the app never asserts a
  "correct" answer. The Sentence Formula grammar check never says
  "wrong" — it says "a few things to check."
- **Zoom** (50%–200%), **Projector Mode** (bigger toolbar text/buttons +
  a visible canvas border), and **Print mode** (a dedicated stylesheet
  hides everything but the board).
- **Undo/Redo**, and (dashboard-only) **Save/My Boards** — named,
  revisitable saved board states. **Save did not come with the
  standalone port** — v1 here has no save at all. See Part 2.
- Large, consistent touch targets; sidebar categories collapse/expand
  independently (a two-level accordion, explicitly modeled on Polypad's
  own sidebar per a teacher-supplied screenshot) rather than anything
  auto-hiding.

### Honest, previously-logged limitations (carried forward, still true here)

- The Graphemes set has never been verified against UFLI's specific
  published scope-and-sequence — the teacher's own UFLI reference links
  and video have been blocked by network policy every time they were
  attempted; nothing has been built or labeled as "this is the real UFLI
  tool" without her supplying the actual material directly.
- Sentence Formula tense conversion covers a fixed, hand-authored verb
  pool, not a general morphological rule.
- The grammar/capitalization check applies a handful of well-established
  rules plus existing word-bank data — not a general-purpose grammar
  engine.
- Consonant-doubling join-rule detection exists in the morpheme logic but
  has no CVC root in the current small root pool to actually trigger it
  yet.

### Deliberately never built (kept out on purpose, not forgotten)

Mad Libs, word-target Sound Boxes/Blending Board, fixed-bucket Word
Sorts, the old tap-to-attach Morpheme Web, the Montessori decision-tree
Sentence Builder, Sentence Formula mastery-gating/auto-detection, a
randomizer, a module-menu/split-view redesign, a Lesson Builder/Activity
mode, and a morphology mini-lesson. **No scripted, target-word, or graded
activity exists anywhere in this tool** — matching the founding
instruction that the open sandbox itself had to be fully developed before
anything activity-shaped could even be discussed.

---

## Part 2 — Why this repo exists, and exactly what came with it

### The ask

Direct instruction from the teacher (2026-09-28), building toward this
repo across a few messages:

> "lets work on the Literacy Manipulatives for right now. this is
> something i want native like it is currently as a tool, but i want the
> concept... to be a separate, non-native tool that other educators can
> access. tell me how to make this work in the easiest way possible. the
> tool for educators will have some free and some paid options."
>
> "If I moved it to its own thing, could I just have it within this
> dashboard, like embedded in some way?... And then when I make any
> changes, I'm doing it in the website part where other educators can
> have access. And I wouldn't need to work on two different files."
>
> "lets make it so its a no save type, no login right now."

So the shape decided on: **one codebase (this repo), embedded back into
the dashboard via iframe**, rather than two parallel copies to maintain.
The dashboard's own native copy (`GrammarSandbox.tsx`) is being swapped
to render this live site inside an iframe on the same screen it always
lived on — see Part 4. Free/paid tiers and accounts are an explicit
**later phase**, not part of this v1.

### What was ported (verbatim or near-verbatim)

Every content library is pure data with zero dependency on the
dashboard's account/store system, so it copied over untouched:
`grammarContent`, `morphemeContent`, `montessoriGrammar`,
`symbolSentences`, `punctuationContent`, `wordChainContent`,
`heartWordContent`, `spellingRuleContent`, `writingScaffoldContent`,
`sentenceFormulas`, `soundContent`, `literacyDesignTokens`. The board
component itself (`GrammarSandbox.tsx`, ~2,750 lines) copied over as
`LiteracyManipulatives.tsx`, keeping the entire canvas/drag-drop engine
and every one of the 16 categories above (minus Word Lists — see below).
`SyncedSpeakButton.tsx` and `ReferencePopover.tsx` copied over with one
change each: no `voiceSkinId` parameter, since there's no marketplace
here to resolve a purchased voice skin against — they just use the
browser's own TTS voices directly.

### What was deliberately left out, and why

All of it ties to the dashboard's student-account/marketplace system,
which has no equivalent here yet:

- **Login/student identity** — there is none. Every visitor gets the
  same, full experience.
- **Save/My Boards** — nothing persists. Reloading the page clears the
  board. (Direct instruction: "no save type, no login right now.")
- **Word Lists category** — this was a read-only view of a teacher-set
  "Literacy Focus" word list, tied to one specific dashboard student's
  account. No account system here yet, so the category is simply absent
  rather than shown empty.
- **Marketplace-purchased voice skins and marker/highlight colors** — the
  dashboard version adds purchased items on top of a base set; this
  version just gives everyone the full base set (all colors, the
  browser's own TTS voices) since there's no purchase concept.
- **Per-student "show punctuation tiles" toggle** — was teacher-gated per
  student in the dashboard; here it's simply always on.
- **Help overlay / Exit-to-home confirm** — both assumed a signed-in
  student and a dashboard "home" screen to return to. Neither applies to
  a standalone page.

None of this is a downgrade left quietly unfinished — it's the direct
result of "no login, no save, right now." Every one of these becomes a
real, deliberate design decision once accounts exist (see Part 5).

---

## Part 3 — Known gaps carried over from the dashboard (still open here too)

- **UFLI blending board / word work mat** — the teacher's own real
  wishlist item, explicitly not built anywhere yet. Every link and video
  she's referenced for the real UFLI materials has been blocked by
  network policy on every attempt; nothing should be built and labeled
  "this is the real UFLI tool" without her supplying the actual source
  material directly (a screen recording, screenshots, or a document
  upload — the same pattern that unblocked the Morpheme content
  originally).
- **Montessori "predictable sentence frames"** — referenced but not
  independently verified from a live source; only the pasted example
  images she supplied were used.
- **Graphemes set vs. UFLI's specific scope-and-sequence** — same
  standing caveat as above; the current set is ordinary, general English
  grapheme content, not a verified reproduction of any specific published
  curriculum.

---

## Part 4 — Embedding into the dashboard (in progress)

The dashboard's `/student/grammar` route is being switched from
rendering the native `GrammarSandbox.tsx` directly to rendering a new
`LiteracyManipulativesEmbed.tsx` wrapper: a full-viewport iframe pointed
at this site's live URL, plus a small "Home" button (the dashboard's own
chrome, matching how other in-game tools present themselves). Since this
v1 has no login, there's no "recognize my own student" handshake to
build yet — an embedded visitor and a direct visitor currently get the
exact same page. `GrammarSandbox.tsx` itself stays in the dashboard's
codebase, unrouted, until the embed is confirmed working live in the
real app — only then does it get deleted for real, which is the moment
"I wouldn't need to work on two different files" becomes fully true.

---

## Part 5 — What's ahead (not yet started)

In roughly the order they'll likely come up, per the teacher's own
framing of this project:

1. **Accounts for outside educators** — sign-up/login so a teacher other
   than Kayden can have her own space here.
2. **Save/load** — once accounts exist, saved boards (the dashboard had
   this; this repo intentionally doesn't yet).
3. **Free vs. paid tiers** — which manipulative categories or features
   are free vs. gated behind a paid account. Not yet decided which
   categories fall on which side.
4. **Payment** — Stripe Checkout plus a webhook that flips an account's
   plan, the standard low-custom-code path, once tiers are decided.
5. **The embed's "recognize my own student" handshake** — once this site
   has real login, the dashboard's embed needs a way to signal "this
   visitor is already one of my own students, skip login and any
   paywall" (e.g. a signed parameter in the iframe URL). Not needed
   today since there's no login to bypass yet.
6. **Delete the native copy** — `GrammarSandbox.tsx` and its
   dashboard-only content-library duplicates come out of the dashboard
   repo once the embed has been confirmed working live for real
   students, closing the loop on "only one file to ever edit again."
7. **The UFLI blending board and any other gap in Part 3** — blocked on
   the teacher supplying real source material, not a build-effort
   problem.
