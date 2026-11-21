# Symbolic Grammar: New Formula Work, Handoff (November 19 to 21, 2026)

Everything from this chat about sentence formulas, gathered in one place to carry into a new chat. Part 1 is the summary: what you said, what was found, what was decided, and what is still open. Parts 2 to 6 are the full reports, most recent first.

## Part 1. Summary

### Your mission, in your words

- Symbolic Grammar teaches writing explicitly before it is taught as creative or artistic. Storytelling can happen orally while the foundational skills form. Once students have explicit instruction, they apply the skills to write creatively, with purpose and meaning, and for research.
- The students: often high support need, with ADHD, autism and communication disorders. They need explicit instruction well beyond current writing programs. The program must still be scaffolded so every student can access it, including general education students.
- "Don't reinvent the wheel," but structure the teaching differently from graphic organizers, writing prompts and sentence starters.
- Formulas must be "rigid enough to be explicit and then can be scaffolded away from the rigidity of formulas so students can write creatively."
- A cornerstone: "anything that is visually based or predictive in nature."
- The formula research log is "merely for research and not for actual curriculum development."

### Your ideas from this chat

- **Formula families**, like word families: groups of formulas taught explicitly in an applied sense. Your four statement formulas with your kindergartner were deliberate. She used word flashcards and the clock cards for past, present and future, with spelling supported about 75% of the time.
- **Sentence study**, modeled on your preschool "sound study" (not letter of the week):
  1. explore how the sound feels in the mouth
  2. connect to words, especially students' names
  3. make a word list with drawn pictures, flashcards and real objects
  4. show the grapheme (lowercase first, then uppercase)
  5. write and practice it
  6. reinforcing activities
  7. daily review of earlier letters, in the SATPIN order, then apply to words, like UFLI

  "I want symbolic grammar to feel like that, where it is procedurally similar every time."
- **Prepositional phrases** need to be a very big part of teaching, given how often they occur.
- **Choice-based formulas for Levels B and C**, and a future Literacy Manipulatives decision tree: pick a sentence, see options for the next one, and keep going into a story plot.
- **Paragraph formulas** that recommend sentence formulas and word structures.
- **Snap cubes** and concrete-representational-abstract with the formulas.
- **Predictable structures**, like Hallmark Christmas movies. Every one follows the same beats:
  1. she is shown in a relationship, or single after bad dating history
  2. she moves to a new place, like a Vermont farm or a city job
  3. she meets a man who seems a bad fit
  4. a charity or festival keeps them close
  5. they grow closer
  6. a falling out
  7. something brings them back
  8. happily ever after

  The same predictability should apply to one-paragraph responses and five-paragraph essays.
- **Level C research paragraph**, five sentences:
  1. an introduction sentence
  2. a sentence introducing the quote
  3. the quote
  4. a sentence restating or supporting the quote
  5. a conclusion sentence
- **Wider sources:** writing groups and support groups, what authors and young authors immerse themselves in, blogs, YouTube, TikTok and Facebook. Also grammar rules and mnemonics.

### Your rulings during this chat

| Topic | Your ruling | Where it is recorded |
|---|---|---|
| Speech tags | "asked Quentin." is a speech tag, never its own formula. No incomplete sentence is ever logged as a formula. Speech tags are noted like prepositional phrases and taught explicitly with dialogue. | D-27; engine 1.7.0 |
| Prepositions | Can stand alone and be part of a prepositional phrase; must be taught explicitly in the units. "Prepositions really need to be worked on" in the engine. | D-25; engine 1.8.0 |
| Numbers | Teach writing numbers explicitly: words under 10, numerals over 10. 10 can be either. | D-26 |
| Naming word before a naming word | "cricket bat" is one thing (one noun symbol over both words). "ocean sand" is two, with ocean describing the sand. Test: can it stand alone as the word and make sense? | D-28 |
| Word groups | "such as", "as well as", "all the" and "than" are one part of speech when they work together, with the symbol floating above both words, like "will run" for a verb. | D-29 |
| Formulas in the log | Break prepositional phrases into their parts of speech. Include commas, colons, semicolons and apostrophes when the sentence needs them. | Log Formulas tool |
| Accuracy | "make sure formulas are actually correct, otherwise this research is useless" | every word's symbol checked by hand |

### What was built in Literacy Manipulatives (on the preview branch, not on main yet)

- **Log Formulas** (Formula Search's second tab):
  - a passage box
  - a table ranked by occurrences, with columns for in our curriculum (check), formula code, formula (word by word, with punctuation), example and occurrences
  - tap a line to see every sentence
  - a book filter and a spreadsheet download
  - Formula and Example are the widest columns
- **The research set:** 111 passages from five PDFs (text only).

  | Book | Passages |
  |---|---|
  | Daily Warm-Ups: Reading, Grade 1 | 20 |
  | DIBELS Oral Reading Fluency, Grade 3 | 20 |
  | Daily Warm-Ups: Reading, Grade 5 | 20 |
  | PowerUp Fluency, Intermediate | 47 |
  | MCAS Grade 10 ELA 2012 | 4 of 6 (two were withheld for copyright) |

  - That is 2,039 complete sentences, every word's symbol checked by hand. 498 naming-word pairs were decided by D-28.
- **Symbolic Grammar Engine changes:**
  - **1.6.0:** a full irregular verb table, so no "-ed" is added where it doesn't belong.
  - **1.7.0:** formula sentences: speech tags and incomplete sentences are left out.
  - **1.8.0:** prepositions. On the checked sentences, the engine now finds 94.8% of prepositions, up from 89.7%, and 98.5% of what it calls a preposition is right.
- **Top 25 Formulas PDF**, with a page listing every passage logged.

### What the data shows (2,039 checked sentences, grades 1 to 10)

| Measure | G1 | G3 | G5 | Intermediate | G10 |
|---|---|---|---|---|---|
| Words per sentence | 7.4 | 11.9 | 11.2 | 12.1 | 22.5 |
| Compound or complex | 12% | 26% | 26% | 32% | 49% |
| Sentences with a prepositional phrase | 47% | 69% | 63% | 65% | 83% |
| Prepositional phrases per sentence | 0.57 | 1.09 | 1.02 | 1.09 | 2.41 |
| Commas per sentence | 0.25 | 0.24 | 0.44 | 0.62 | 1.75 |

- **Kernel sentence types hold steady across grades:**
  - S1 (subject + verb): 20 to 22%
  - S2 (with an object): 45 to 57%
  - S3 and S4 (be + describing or naming word): 12 to 16%

  Growth comes from expanding and joining sentences, not from new sentence types.
- **Exact formulas almost never repeat:** 1,811 different formulas in 2,039 sentences, and 1,662 of them appear only once. Only 26 of your listed formulas appear, in 3% of sentences.
- **Kinds of sentence:**

  | Kind | Share of sentences |
  |---|---|
  | Statements | 63% |
  | Compound or complex | 28% |
  | Questions | 4% |
  | Commands | 3% |
  | Exclamations | 3% |

- **Who starts a simple statement:**

  | Who | Share |
  |---|---|
  | Pronoun | 43% |
  | Noun with describing word | 15% |
  | Noun alone | 12% |
  | Name | 11% |
  | Article + noun | 10% |
  | Compound subject | 5% |

  - Your four Who formulas cover about 76 to 79%.
- **Tense:** 50% past, 47% present, 3% future.
- **Prepositional phrases:** in 64% of sentences, but they open only 3% of them. The most common prepositions are to, of, in, on, for, at, with and from.
- **Joining words:** and, that, when, but, or, if, so, because.

### The research, and its limit

- **No full-text source was opened.** This session's network blocks journal, ERIC, IES, EEF, ASHA and Reddit sites, and the request to unblock them was rejected. Every citation comes from search summaries and is labeled "search summary, not opened".
- **In the master doc**, 19 sources are logged in Research §36 as "Flag for review". None is Accepted.
- **Strongest research points:**
  - Grammar taught on its own hurts writing (about -0.32). Sentence combining helps (about 0.50).
  - Explicit strategy instruction gives the largest effects for students with learning disabilities and autism.
  - Explicit grammar works for developmental language disorder. Shape Coding is the closest visual system with trial evidence.
  - Writing that isn't automatic yet crowds out ideas.
  - Dictation helps.
  - Oral storytelling does not turn into writing by itself; it has to be tied to writing in the same sitting.
  - Transfer to new kinds of writing must be taught.
  - Faded scaffolds beat constant ones (claim-evidence-reasoning in science).
- **Where your designs are ahead of the research:** no study tests these yet, so they are design choices to pilot:
  - formula families
  - a daily sentence-study routine
  - snap cubes for grammar
  - sentence formulas assigned to paragraph or story slots
  - the decision-tree tool

### The proposals so far (Parts 2 and 3)

- **Sentence families (most recent, Part 2):**
  - A family keeps everything but one slot, like a word family keeps its ending.
  - Eight families: Who, Time, Where/When, Be, Object, Describe, Kind and Join.
  - Nine routines with the same teacher words: Family Introduction, Swap, Sort, Hunt, Mix, Change, Map, Ladder and Count.
  - A Pre-A to C sequence.
  - Your kindergarten session as the template lesson.
  - Teach the Who family in past tense first, so only the who changes.
- **Scaffolding proposal (Part 3):**
  - **Main option:** one six-stage fade path, the same for every formula, paragraph and story: Rebuild, Swap, Fill, Code, Choose, Free. Moving on requires fluency plus a test with new words. Missing the target twice sends the student back one stage.
  - **Supporting option 1:** same path, different entry point and pace, with any response mode.
  - **Supporting option 2:** run the path backward (students code a model sentence and their own writing, then rebuild from the code alone), then change one rule on purpose.
- **Kernel sentences (Part 4, Part 1 of that report):**
  - Your codes already are a kernel system: S1 to S5 match the classic English kernels.
  - Three options: A keeps your list as the unit; B teaches kernel plus moves; C mixes by level, with specific formulas at Pre-A and A and kernel plus moves at B and C. C was recommended; the choice is yours.
  - Gaps in your list: it leans heavily on S1, S4 to S6 have one model each, and two patterns have no code (two objects; object plus describer).

### Open decisions for you

1. Which four formulas did you teach your kindergartener? Assumed: S1.A, S1, S1.P and S1.PN from Lesson 1.1.
2. Do you accept the family rule (one slot changes), and is "family" the word students hear?
3. Who family order: yours or Beth's? Should the verb stay in past tense until the swap is fluent?
4. Kernel option A, B or C?
5. Adopt the six-stage fade path and its names? What fluency numbers go in the mastery rule?
6. D-25 conflict:
   - Your formula list codes "We stayed in because it rained." as (S1.P.B)C[S1.P], and the "Sit down." card reads "down" as an adverb.
   - D-25 says a standalone preposition is a preposition.
   - The engine currently follows your list; the research log follows D-25. Which wins?
7. Which symbol does each word group take? Proposed:
   - such as, because of, instead of: preposition
   - as well as, rather than: conjunction
   - more than, all the: adjective
8. Lesson 1.1 writes R where later lessons write PRP ("Luna lives in Texas." is S1.PN.R). Do they mean the same thing?
9. Should the engine add a label for which slot each part fills, so sentences can be sorted into families automatically?
10. Codes for the two missing patterns, and more S2 formulas (S2 is 45 to 57% of real text)?
11. Is a symbol card a valid response mode within your scope boundary on AAC?
12. Where does dialogue get taught explicitly, and what is the code for a speech tag (D-27)?
13. Where does the numbers skill go, and how is Level A taught it (D-26)?

### Where things live

- **Master doc** (Beth's home for all decisions): https://claude.ai/artifact/PfM4hZruArpkDubNb8Q3UQ
  - Decisions D-25 to D-29.
  - Goal P11, "Formula families and sentence study".
  - Ideas DR-28 to DR-36.
  - Open questions 14 to 28.
- **Literacy Manipulatives repository**, branch `claude/practical-dirac-1pq303`:
  - `reports/` holds the five reports.
  - `research_notes/` holds the research notes behind them.
  - `public/formula-research/sentences.json` holds the 2,039 checked sentences.
- **Symbolic Grammar Engine:** version 1.8.0 on branch `claude/practical-dirac-1pq303`. Not on main yet.

