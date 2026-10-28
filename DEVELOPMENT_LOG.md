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

---

## Part 6 — Writer: the word processor (started 2026-10-27)

### The ask (teacher, 2026-10-27, summarized)

A word processor inside Literacy Manipulatives, **separate from the whiteboard**, opened from a button in
the top toolbar, with a **return button** back to the board. Students write in an environment the
**teacher defines**:

- **Spell check at a teacher-chosen level.**
- **Predictive text** that catches what a student meant from how it sounds and the words around it:
  "cat", "cach", "kach", "katch" typed where *catch* belongs becomes **catch**.
- **Auto-capitalization** when the teacher turns it on.
- **No AI add-ons**: Grammarly and similar writing helpers must not work here.
- **Grammar symbols** from her Symbolic Grammar program shown **above or below** each word, in
  **small, medium, or large**. Large matches the symbol sentence cards (symbol on top, example word
  beneath it).
- **Grammar check from the Symbolic Grammar curriculum**: when a sentence isn't grammatical (for
  example, no verb), show the matching **sentence formula** and let the student **insert** the missing
  part. Teacher settings decide whether it shows like a spell/grammar check, and **when** it checks
  (as they type, or at each end punctuation).

### Teacher settings (the environment)

| Setting | Options | Default |
|---|---|---|
| Spell check | Off; Mark mistakes; Mark and suggest | Mark and suggest |
| Predictive text | Off; Suggest (tap or Tab to accept); Fix automatically | Suggest |
| Auto-capitalization | On / Off (first word of a sentence, the word I) | On |
| Grammar check | Off; At end punctuation; As they type | At end punctuation |
| Grammar symbols | Off; Above words; Below words | Above words |
| Symbol size | Small; Medium; Large (card-style) | Medium |
| Block writing add-ons | On / Off (Grammarly, LanguageTool, browser spell check and autocorrect) | On |

Settings belong to the teacher. On a shared board, students get the teacher's Writer settings with the
board and cannot change them (same path as the shared font).

### How it's built

- **Screen**: `src/components/Writer.tsx`, shown in place of the board (the board stays as it was).
  The draft is kept per tab like the board (a refresh keeps it; a closed tab starts fresh).
- **Dictionary**: SCOWL word lists (`wordlist-english`, sizes 10 to 40, about 42,000 words, ranked by
  how common they are) shipped as `public/writer/words.json` and loaded only when the Writer opens.
- **Sound-alike matching**: each word gets a "kid spelling key" (c/k/ck/q sound the same, tch = ch,
  ph = f, silent kn/wr, doubled letters collapse, vowels grouped), so *kach*, *katch* and *catch* share a
  key. Suggestions rank by key match, edit distance, how common the word is, and **context**: the part
  of speech the slot needs from the words around it (after *will / can / to / don't* a verb is expected,
  after *a / the / my* a noun or describing word), using the same tagger as Symbol Sentence search.
  That context is what lets a real word in the wrong place (*cat* in "I will cat the ball") become *catch*.
- **Symbols**: a mirror layer under the text area lays out the same text, tags every word, and draws
  its symbol above or below it; the text area's line height grows to make room.
- **Grammar check**: per sentence (verb, subject or command, capital, end mark, a/an, subject-verb
  agreement), reusing the board's checks. The fix shows the closest formula from the 43-card deck
  with the missing part highlighted, and an Insert button that drops a blank for that part where the
  formula has it.
- **Blocking add-ons**: `data-gramm="false"`, `data-gramm_editor="false"`, `data-enable-grammarly="false"`,
  `data-lt-active="false"`, `spellcheck="false"`, `autocorrect="off"`, `autocapitalize="off"`, and
  injected helper UI hidden. Honest limit: a browser extension that ignores opt-out attributes can't be
  stopped by a web page; school-managed Chromebooks can block extensions by policy.

### Curriculum alignment (her Program Overview and Sentence Formulas, 2026-10-27)

- The grammar check **is her Sentence Check**: complete (a Who part and an Action), capital at the start (and
  names and I), end mark, match (one or many), time (kept the same). Each sentence shows all five with a
  check or an empty box.
- Formulas come from her **Sentence Formulas master list** (`src/lib/writer/formulas.ts`, 117 rows: unit,
  skill, shorthand name, example, required words, code, purpose). The closest one is shown with its symbols
  and model sentence. Formulas are a teaching map, never a score, so nothing is graded by formula.
- Wording follows her **levels**: Level A leads with student words (Who part, Action word), Level B uses
  both, Level C leads with grammar terms (subject, verb). Codes (A-N-V) show at Levels B and C only.
- Symbols always appear with words (dual coding), above the words by default, like her formula strips.

### Accessibility tools (Claudia's research, 2026-10-27)

Rule used to decide who controls each tool: a support that changes **what the student produces** (how words
get spelled, chosen, checked or entered) changes what the writing sample measures, so the **teacher defines
it** and the sample counts as **supported** (her "Compare like with like" principle). A support that only
changes **how the text looks or sounds back** is the **student's choice** and does not mark the sample.
"Teacher, student may toggle" means the teacher decides whether the student can switch it.

| # | Tool | Who sets it | Evidence | Notes |
|---|---|---|---|---|
| 1 | Support record on every draft (settings in effect, predictions accepted, auto-fixes, read-backs) | Always on | Foundation for her data rules | Makes supported vs unsupported samples traceable |
| 2 | Read aloud with word highlighting (word, sentence, whole piece, speed) | Teacher, student may toggle | Moderate (Wood et al. 2018 meta-analysis) | Browser speech, local voices preferred |
| 3 | Typing echo (speaks each word or sentence as it's finished) | Teacher, student may toggle | Limited | Same speech engine |
| 4 | Word prediction upgrades (spoken choices, number keys, teacher topic lists) | Teacher | Moderate for spelling | Builds on the Writer's prediction |
| 5 | Speech-to-text dictation | Teacher | Moderate to limited | Chrome sends audio to Google; needs opt-in and privacy review |
| 6 | Teacher word banks with pictures (tap to hear or insert) | Teacher | Limited to moderate | Check picture-symbol licenses |
| 7 | Sentence frames and word tiles in Symbolic Grammar formula order | Teacher | Moderate (WWC writing guide) | Always a supported sample |
| 8 | Core-word symbol board for students who can't type yet | Teacher | Limited | Waits on her AAC consultation (Program Overview) |
| 9 | Planning panel and strategy checklist linked to the Sentence Check | Teacher, student may toggle | Strong (WWC) | |
| 10 | Letter, word and line spacing; text size | Student | Moderate (Zorzi 2012; Marinus 2016: spacing is what helps) | Also meets WCAG 1.4.12 |
| 11 | Fonts (Inclusive Sans, OpenDyslexic, cursive) | Student, teacher default | Weak for dyslexia fonts (Wery and Diliberto 2017) | A preference, not a treatment; teacher can lock cursive when reading cursive is the goal |
| 12 | Contrast themes, thick caret, strong focus ring, zoom | Student | Standards (WCAG) | |
| 13 | Line focus (reading ruler around the cursor line) | Student | Limited (Niklaus 2023) | |
| 14 | Background tints | Student | Weak (overlay reviews) | Offered as comfort only, never as a dyslexia fix |
| 15 | Motor access (keyboard and switch use, large targets, duplicate-key filter for tremor, no time limits) | Teacher, student may toggle | Standards and AT practice | |
| 16 | Syllable split and homophone help | Teacher, student may toggle | Limited | Off for spelling or grammar probes |
| 17 | Focus mode (hide panels, one sentence at a time) | Student, teacher default | Limited | Helps attention |

Avoid or handle with care: generative AI rewriting or sentence completion (replaces the student's
composition; prediction stays one word at a time), silent autocorrect (corrections stay visible with Undo and
are logged), symbols and Sentence Check during unsupported probes (lock them off), cloud dictation without
opt-in, presenting fonts or tints as fixes, and speed timers.

Next for assessment: an **assessment mode** that snapshots and locks the settings when a probe starts; that
snapshot is the accommodation record (her principles 4 and 5).

### Build queue

1. ~~Plan in this log~~ (this section)
2. ~~Writer shell: toolbar button, separate screen, Back to whiteboard, saved draft~~ (first version)
3. ~~Teacher settings panel, synced to students~~ (students follow the teacher into the Writer)
4. ~~Block writing add-ons~~
5. ~~Spell check + predictive text (sound-alike keys, context, levels)~~ (first version)
6. ~~Symbols above or below words, three sizes~~
7. ~~Grammar check with sentence formulas and Insert~~ (first version)
7a. Share/join from the Writer, same code and join page as the whiteboard (first version in)
7b. ~~Accessibility batch 1: who-sets-it model, My tools panel, read aloud with highlighting, typing echo,
    spacing, line focus, contrast themes, focus mode, support record~~ (first version)
7c. Accessibility batch 2: word banks with pictures, sentence frames, dictation (opt-in), motor access
7d. Assessment mode: lock settings, stamp the sample supported or unsupported
8. ~~Her answers to the 10 questions (2026-10-28)~~: see "Her answers" below
9. Next: word banks from the board's word lists, sentence frames, motor access, sentence or word-count
   goals, assessment mode (7c, 7d)

### 10 questions to steer the build

1. **Who changes the settings?** Only the teacher's own screen (as now), or should students on their own
   devices without a shared board also be locked out (for example, a teacher PIN)?
2. **Predictive "fix automatically"**: should it change the word silently, or flash the change with a
   one-tap undo so students see what changed?
3. **Spell check for younger writers**: should "Mark mistakes" show only words the student is likely to
   know (the most common 4,000), or every misspelled word?
4. **Symbols for every word**, or only content words (nouns, verbs, describing words) at the small size
   to keep lines readable?
5. **Large size**: the card style puts the symbol above and the word beneath. With "Below words", should
   large flip that (word on top, symbol under)?
6. **Grammar check display**: a list beside the writing, a pop-up at the sentence, or a colored
   underline the student taps?
7. **Insert**: should Insert drop a blank to fill ("___"), the symbol itself to type into, or a
   suggested word?
8. **Which formulas** count as correct: only the 43-card deck patterns, or any sentence with a subject
   and a verb?
9. **Saving and sharing writing**: should the teacher see each student's draft live on a shared board,
   collect it at the end, or is writing private to the student's screen?
10. **Extras**: printing/PDF, read aloud (text to speech), word banks from the board's word lists, a
    word count or sentence count goal?

### Her answers (2026-10-28) and what was built

| # | Her answer | Built |
|---|---|---|
| 1 | No PIN. Off a teacher's shared board, students have full access to the settings they define. | Unchanged: own device = every setting; joined to a board = the teacher's settings plus "Student choice" tools in My tools. |
| 2 | Students stay in charge of automatic corrections: approve, undo, redo. | "Fix automatically" now waits for the student: Changed X to Y, **Keep** or **Undo**; after Undo, **Redo**. Nothing times out. Undos are counted in the support record. |
| 3 | Levels of spell check. | Spell check: Off, **Common words only** (marks only misspellings of the ~4,000 most common words), All words. Spelling help is separate: Mark, or Mark and suggest. |
| 4 | Symbols on or off, always above the words; large = the symbol sentence cards. | Symbols: Off, On, Student choice. Always above, centered on the word. Large is 72px, the card size, with wider word gaps so each word has its own column. "Below words" removed. |
| 5 | Symbol centered, above the word. | Done (same as 4). |
| 6 | A movable Sentence Check the student can tick; if they tick something that isn't done, show an open spot where it's needed; setting dependent. | The Sentence Check is a window the student drags anywhere. Setting "Who ticks the list": the Writer, the student, or student choice. When the student ticks an item that isn't done, it shows "Not yet" and dashed open spots appear in the writing: a slot where a missing subject or verb goes, a box where end punctuation goes, outlines on letters to capitalize, verbs that don't agree or change tense. |
| 7 | Insert drops the symbol (a blank if symbols are off). Use the true grammar terms. | "Add a verb" / "Add a subject" drops a blank with the part's symbol over it. All check wording now uses subject, verb, capital letters, end punctuation, subject-verb agreement, verb tense, at every level. Levels now only change whether formula codes show. |
| 8 | A correct sentence that isn't a formula yet: keep a list of these patterns for future formulas, and let students "add formula to my book". | Sentences that pass all five checks but match no formula are collected as **Formula ideas** (with examples and who wrote them; students' reach the teacher on a shared board). Students get **Add formula to my book** and a **Formula book** to look back at. |
| 9 | Shared pages like tabs; the teacher and up to five students typing at once; per page and per student: pencil (edit), eye (view), X (hidden); e.g. an example page everyone can read and a page only one student sees. | **Pages** (tabs) in the Writer. The teacher adds pages, names them, and sets each student's access with pencil, eye or X, or "A page for each student". Everyone with edit access types in the same page at once, live, with each person's cursor and name shown in their color. Built on Yjs (a CRDT) over the board's Supabase channel; the teacher's copy is the true one and only accepts edits from students who may edit that page. |
| 10 | Dictation first, then print. | **Dictate** (speech to text, "period", "comma", "question mark", "new line" spoken as marks), set Off / On / Student choice and counted in the support record. **Print** prints only the page with its symbols and a header: page name, student, date, supported or unsupported writing. |

### Write mode changes (her notes, 2026-10-28, later)

- **Name**: the Writer is now **Write** ("write mode"); the toolbar button reads Write.
- **Symbols** appear only once a word is finished (a space or mark typed after it).
- **Word jobs from the word and its place in the sentence** (`src/lib/writer/tagger.ts`): neighbors decide
  between a word's possible jobs ("down the path" preposition, "fell down" adverb, "How" at the start of a
  quote an adverb not a name, "two jobs" adjective, "like" verb or preposition, capitalized sentence starts
  are names only when the word list doesn't know them). Checked against all 117 of her formula sentences:
  116 match her codes (the miss: "Some people think recess wastes time...").
- **Contractions do two jobs** and show two symbols: "We've" pronoun + verb, "can't" verb + adverb (her
  formulas still count "doesn't" as one V when matching), "Let's" verb + pronoun.
- **My dictionary**: tap a marked word, "Add to my dictionary", choose its job (Name, Noun, Verb...). Added
  words are never marked and take the chosen symbol. Listed and editable in Settings.
- **One Settings menu** (My tools and Writing settings combined), each row marked Teacher sets, Your choice
  or Set by your teacher. Text style (Regular, Cursive, Dyslexia, same as the whiteboard), letter, word and
  line spacing set separately, symbols on/off.
- **Sentence Check only when asked**: select a sentence (or click in one, or select a whole paragraph) and
  press **Check sentence**. Nothing is ticked or underlined before that. The window has one tab per check
  (Complete, Capitals, End mark, Agreement, Tense, Formula) and steps through the selected sentences one at a
  time; open spots show only for the open tab.
- **Sentence formulas** (was Formula book): searchable (words, codes, or type a sentence to find formulas with
  its pattern), tabs for her units plus My formulas and Formula ideas, each formula opening into past,
  present and future versions with symbols (`src/lib/writer/tenses.ts`); the window moves, resizes from its
  corner and goes full screen.

### How a word's symbol is chosen (her note 2026-10-28: "this is a teaching tool, it is important we are accurate")

`src/lib/writer/tagger.ts`, the same four steps for every word:

1. **Dictionary.** The jobs a dictionary lists for the word, most common first: `public/writer/pos.json`, built by
   `scripts/build-pos.mjs` from WordNet 3.0 (Princeton license in `public/writer/WORDNET-LICENSE.txt`), using how
   often each sense was seen in tagged text; forms WordNet doesn't list (dogs, ran, taller) take their base
   word's jobs. Plus the board's word lists, closed word groups (articles, pronouns, prepositions...) and the
   student's own dictionary. Jobs that are rare for a word ("cat" as a verb) are marked rare.
2. **Context.** When a word can do more than one job, its neighbors decide: after "a"/"the" and before a noun a
   describing word ("a large, brown hat"), after a subject a verb, after "will"/"to" a base verb, after a verb
   with nothing after it an adverb ("fly south"), names by capital letters, questions ("Did the dog bark?"),
   words joined by "and" doing the same job ("runs and jumps").
3. **Spelling.** A misspelled word gets **no symbol**, and its neighbors are judged by the word the student most
   likely meant, so a misspelling never decides another word's symbol. A real word that doesn't fit its spot
   ("I will cat the ball") also gets no symbol and a dotted orange line.
4. **Recheck.** Every open-word job is checked against the dictionary again, and every article, number or
   my/your/their must lead to a noun (describing words in a row, with commas or "and", end in one).

Tested on her formula model sentences and 32 everyday sentences (all match).

### How spelling suggestions are ordered (her note 2026-10-28: "the most likely word first")

`src/lib/writer/spell.ts`: 0. a known everyday misspelling first (sed: said, becuz: because, frum: from...);
1. sounds the same, vowel sounds included ("fether" sounds like feather, not father); 2. fits the sentence
(the job the spot calls for, using only common dictionary jobs; words that go with the next thing); 3. fewest
changes, with left-out letters counting least (the most common slip: frend, fether); 4. same first letter;
5. more common words first.

### Fragments and run-ons (her request 2026-10-28)

Once a sentence has its end mark and the student has moved on from it, `sentenceIssue` in
`src/lib/writer/sentenceCheck.ts` marks it: a **red wavy line** under an incomplete sentence (no verb: "A man.";
no subject: "Named Rob."; only a joining-word clause: "Because I was tired.") and a **blue wavy line** under a
run-on (two sentences with only a comma between them: "The cat sat on the mat, it was soft."; or nothing between
them: "I like dogs they are fun."). Tapping the sentence says what's wrong, with **Split into two sentences** for
a run-on and **Check sentence**. Run-ons with nothing between the sentences are marked only when the first
sentence clearly ended (a describing or how word, a capital letter, or "is/was" next), so "the book he gave me"
isn't marked. Commands ("Close the door.", "First, wash your hands.") and short replies ("Yes.", "Thank you.")
aren't fragments. Tested: 24 example sentences right, none of her 117 formula sentences marked. Also: "Dr. Lee"
no longer splits into two sentences.

### Her formula cards power Write mode (2026-10-28)

Her Symbolic Grammar Formula Cards folder (Formula Master List PDF: 118 formulas, Units 1-10, plus a formula card and
a sentence card for each) replaces the earlier 117-row list. `scripts/import-formula-cards.py` reads the PDF and the
cards and writes `src/lib/writer/formulas.ts` (lesson, her code, the card's words, slots, model sentence, card
images) and small WebP copies of the 236 cards in `public/literacy/formula-cards/` (2.2 MB).

- **Matching reads a sentence the way her cards do** (`src/lib/writer/formulaMatch.ts`): one card per word, a
  prepositional phrase as one card ("to the park"), required words named on the card (be, will, do, not, feel,
  and, because, that...), contractions as two cards. All 118 model sentences match their own card except one
  ("According to the book, frogs swallow food whole": "whole" reads as a describing word).
- **Her codes for new sentences**: a sentence that matches no card gets a code in her notation (S1-S6, Sn, Q1-Q3,
  C1/C2/Cn, E1/E3; A, PN, P, N's, V, J, B, PRP, C, I; (X)+(Y), (X)C(Y), C(X)(Y), (X);(Y), B(X), PRP(X), PN(X),
  P'V and V'B for contractions). Her own codes come out the same for 112 of her 118 model sentences; the rest use
  notation for relative clauses ([1.P]), quotes and appositives that isn't built yet.
- **Sentence formulas** shows each formula card (tap for the sentence card), her code (Levels B and C), the card
  words, the model sentence and its past, present and future; search by words, code or lesson, or type a
  sentence to find the cards with its pattern ("Same as your sentence").
- **Write with this formula** puts the card's slots above the page; each slot fills in (with the student's word)
  as the sentence is written, the next one is highlighted, and the frame turns green when the sentence matches.
- **Sentence Check, Formula tab** shows the matching formula card, or the closest card's sentence card to try,
  or "A new formula" with her code and the symbols, to add to the student's formula book.
- Symbol accuracy work done for this: possessives ("the dog's bone", "her hands"), "Which dog", "more exciting",
  "as hot as", "until the bus came" (a joining word), questions with be, "isn't wet", "so that", and a sentence
  always gets a verb when one of its words can be one.

Honest limits: hidden pages are hidden in the student's screen, but their text still travels on the shared
channel (a classroom setting, not a privacy guarantee). Dictation needs a browser with speech recognition
(Chrome, Edge, Safari). Live co-editing needs the Supabase share setup, as the whiteboard does.

---

## 2026-10-14: Her new grammar symbols and the 43-card symbol deck

Teacher request (verbatim): "lets update the literacy manipulatives whiteboard with these", with
`Recreated_Grammar_Symbols_4.zip` and `Grammar_Symbol_Cards.zip`.

- **New symbol art, all ten parts of speech** (`public/literacy/grammar-symbols/`): noun = red pointing
  hand, adjective = light blue circle with a pencil, verb = green four-way arrows, adverb = dark blue gear
  with a pencil, article = pink magnet, pronoun = yellow circling arrows, conjunction = purple two-way arrow,
  preposition = brown box, interjection = orange exclamation mark (cut from her grid sheet), and a **new
  tenth symbol: proper noun = red crown**. Each PNG had its white background removed, was trimmed and
  centered at 256 px. Definitions on hover are her own words from the key sheet; colors were measured
  from the new art (`src/lib/montessoriGrammar.ts`).
- **Fix found on the way:** this standalone repo never had a `public/literacy/grammar-symbols/` folder
  (the art only existed in the dashboard repo), so the symbol pictures were missing on the live site.
  They ship with this repo now.
- **The 43-card deck** (`src/lib/symbolSentences.ts`): cards 1 to 33 are the same patterns as the 11
  existing Symbol Sentences pages, so those stay. Cards 34 to 43 are new and use the proper noun crown;
  they are a new 👑 Proper Nouns page, with ordinary example sentences written to fit each card's symbol
  pattern (the deck itself shows symbols only).

---

## 2026-10-15: Word bubbles attached to the symbols

Teacher request (verbatim), with a picture of "He tied his skates in his stinky locker room ." built from
the symbols with a colored word pill under each icon: "claudia, give me a view like this in literacy
manipulatives. i want the text bubble to be attatched to the icon itself. solid and outline options should be
available. always have punctiuation as a separete icon. should be able to type words in bubbles, even
replacing default/random words"

- **Symbol Sentences on the board** now look like her picture: each symbol with its word bubble attached right
  under it, in the symbol's own color, and the sentence's punctuation as its own gray icon (the comma after
  "Softly" too, not only the period at the end). The bubbles start with the card's own words; tap any bubble
  and type to replace it. Tap a punctuation icon to switch it between . ? ! and ,. A selected sentence has ↺
  (its own words back) and a solid/outline switch. This replaces the old ⚙️ "Type each word" pop-up.
- **Single Grammar Symbols** get the same attached bubble (empty, with the part of speech as a hint). A
  selected one has 🎲 (a random word for that part of speech, which can then be typed over) and the
  solid/outline switch. This replaces the old ⚙️ "Add a text field" (the separate Text Box tool is unchanged).
- **Solid or outline:** a "Word bubbles: Outline / Solid" switch at the top of the Grammar Symbols and Symbol
  Sentences trays sets every bubble on the board at once and the style of new ones.
- **Punctuation always stays its own icon:** marks typed into a word bubble are left out.
- Code: `src/lib/wordBubbles.ts` (sentence tokens, random words, text color), `WordBubble`, `PunctIcon` and
  `BubbleToggle` in `src/LiteracyManipulatives.tsx`, styles at the end of `src/index.css`.
