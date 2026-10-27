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
8. Next (after her answers below): printing/export, word bank, read aloud, saving per student, teacher
   view of student drafts

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
