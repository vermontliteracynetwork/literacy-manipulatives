# Symbolic Grammar Engine: the rules

Version 1.0.0 (2026-11-13). This is the rulebook for the one grammar engine that every Symbolic Grammar and Literacy
Manipulatives project uses. It says, in plain words, how the engine gives each word its grammar symbol and how it
writes a sentence's formula code. The curriculum (her Symbolic Grammar doc and her research with Beth) and the engine
follow the same rules. When a rule changes in one, it changes here, and a test sentence is added (see the end).

## 1. The grammar symbols

Ten symbols, with her names and her words for each (`src/grammarSymbols.ts`):

| Symbol | Picture | Her words |
|---|---|---|
| noun | red pointing hand | Person, place, thing, animal |
| proper noun | red crown | A specific noun (it has a name) |
| article | pink triangle | Refers to nouns |
| adjective | light blue circle with a pencil | Describes nouns |
| verb | green four-way arrows | Action words |
| adverb | dark blue gear with a pencil | Describes verbs and adjectives |
| pronoun | yellow circling arrows | Replaces a noun |
| preposition | brown box | Identifies time, place, or direction |
| conjunction | purple two-way arrow | Connecting words |
| interjection | orange exclamation mark | Something you shout |

Her symbol conventions the engine follows:
- **my, your, his, her, its, our, their** take the **pronoun** symbol.
- **not** and time or place words like **home** and **inside** take the **adverb** symbol.
- **Joining words** (and, but, or, because, that, when, if) take the **conjunction** symbol.
- **Helping words** (will, can, could, do, does, did) take the **verb** symbol.
- **A contraction gets two symbols**: "We're" is a pronoun and a verb, "can't" a verb and an adverb (not), "Let's" a verb and a pronoun.
- Past, present and future have their own symbols; a tense symbol sits on a verb.

## 2. What a word can be (the word list)

The engine first lists every job a word can do, most common first:
1. **WordNet** parts of speech (Princeton WordNet 3.0, `data/pos.json`), ordered by how often each use is seen. Rare uses are kept apart, so "cat" is not a verb when a student's word is checked.
2. **The closed word groups**: articles, pronouns, prepositions, conjunctions, interjections, helping verbs, number words.
3. **Her board's word lists** (the Grammar Symbols and Symbol Sentences word lists).
4. **Word endings**, only for a word no list has: -ly tells how; -ed and -ing are doing words; -er and -est compare.
5. **Live lookups** (outside dictionaries) only when a teacher turns on "Allow live lookups".

**Does a word fit a symbol?** (a student types a word into a symbol's bubble) The word's common jobs decide. A name
fits a noun. my, their, a number or an 's word fits an adjective (it tells which one). An -ing or -ed word fits an
adjective ("the running water"). An action word fits a noun ("a jump"). A word no list knows is never marked wrong.

## 3. How a word gets its symbol in a sentence

A word's place in the sentence decides between its jobs. In order:

1. **Spelling.** A misspelled word is marked to check, and the words around it are read as if it were spelled right.
2. **Closed words** do their one job (the, my, and, in...).
3. **Neighbors decide** for words with more than one job, for example:
   - After a subject ("I", "she", a name, "the dog"), a word that can be a verb is the verb: "They **jump**".
   - After a helping word or "to": the verb: "will **run**", "want to **fish**".
   - After "a", "the", "my" or a describing word: a describing word when a noun still follows, otherwise the noun.
   - A preposition points to a noun after it ("over **the log**"); "up", "out" and "outside" with no noun after them tell where (adverb).
   - "until the bus came": a joining word, not a preposition, when a subject and its verb follow.
   - A capital letter where a sentence does not start means a name.
   - "runs and jumps", "big and red": the word after "and" does the same job as the word before it.
4. **The engine's sentence rules** (her request 2026-11-13, "a strong logic behind our mark ups"):
   - **A word right after an article, a possessive (my, our...), this/that or a number starts a noun phrase and is never a verb.** It describes when a noun follows ("the **big** dog"), otherwise it is the noun ("the **plant**").
   - **A number describes the noun after it**: "**two** birds".
   - **A sentence must have a verb**: the first word that can be one right after a whole noun phrase is the verb ("A dog **sees**", "The light **turned** green").
   - **A sentence never starts with a command in its -s form**: in "Ducks swim", Ducks is the noun.
   - **After be or a linking verb** (turn, become, look, feel, seem, grow, get, smell, sound, taste, stay), a describing word describes the subject: "You're **kind**", "turned **green**".
   - **The last word after a verb's object that tells how is an adverb**: "frogs swallow food **whole**".
5. **Recheck.** Every article or describing word must lead to a noun; a word the dictionary knows only does jobs the dictionary lists for it.
6. **Teacher fixes** (section 6) come last.

## 4. Formula codes (her notation)

A sentence is read as her formula cards read it: one card per word, except that a **prepositional phrase** ("to the
park") is one card, and **required words** (be, will, do, not, feel, said, and, because...) are named on the card.

**Clause types:**
- **S1** subject + verb; **S2** with an object; **S3** be + describing word; **S4** be + noun; **S5** be + prepositional phrase; **S6** feel + describing word.
- **Sn** a "not" statement (Sn1, Sn3...).
- **Q** questions (Q1, Q2 with an object, Q3 be + describing word).
- **C** commands (C1, C2 with an object, Cn "don't").
- **E** exclamations (E1, E3).

**Parts after the type** (each one is counted):
- A article; PN proper noun; P pronoun.
- N's a noun that owns ("the dog's"); PN's a name that owns.
- N a noun set off by commas that renames the subject ("Max, **my dog**, barked": S1.PN.P.N).
- V each extra verb; J describing word; B how word; PRP prepositional phrase.
- R an in/at phrase naming a place, or an on/in phrase naming a day, month or holiday ("Luna lives **in Texas**": S1.PN.R, her working code).
- C joining word; I interjection.
- A contraction joins its parts with an apostrophe: P'V ("We're"), V'B ("isn't"), V'P ("Let's").
- In an S4 sentence with a pronoun in the subject, P comes before A ("My room is a tornado": S4.P.A); otherwise A comes first ("Max is a dog": S4.A.PN).

**Joining sentences:**
- An opener and a comma come first: B,S1.A ("Quickly, the dog ran"), PRP,S1.A ("After lunch, ..."), PN,C2.A ("Sam, close the door").
- A name after a command: C2.A,PN ("Close the door, Sam").
- Two sentences joined by and, but, or, so: (S1.A)C(S1.A).
- A part that starts with because, when, that, if, after, before, since, until, while, although or so that goes in square brackets: (S1.A)C[S1.A]; when it comes first, C[S1.P],(S1.P.B).
- A who or which part about the subject: S1.A[1.P] ("The girl who won smiled"); with commas, S1.A,[3.P], ("The cat, which was small, hid"). The part is written by its own type without the S.
- A semicolon: (S1.P);(B,S1.P.B).
- Quoted speech: S2.PN,"C1.V'P" ("Mia said, "Let's swim!""). The quote is coded on its own.
- A one-word exclamation is I ("Wow!", "Crash!").

**Matching a sentence to her list:** a sentence matches a formula in her All Sentence Formulas list
(`src/writer/formulaList.ts`, 121 formulas) when its code is the same, or its cards are the same. A contraction
formula only matches a sentence with that contraction. Each code is shown once.

## 5. What is checked (the tests)

`npm test` in this package runs every check, and fails if anything is wrong:
- **80 hand-checked sentences** (`src/writer/engineTests.ts`), every word's symbol, including 40 with words that can be a noun or a verb (play, cook, rock, light, park, plant, water...).
- **Her whole formula list**: all 121 example sentences must code exactly as she wrote them.
- **Her 118 formula cards**: every model sentence must read as its own card.
- **Every shared teacher fix** (section 6) must hold.

The same checks run in the app (Formula Search, Mark up a passage tab, **Check the engine**), and on GitHub for
every change to the engine.

## 6. Teacher fixes

When the engine gives a word the wrong symbol in a real sentence, a teacher taps the word and picks the right symbol.
The fix is kept with the words around it and used:
1. in the same sentence, always;
2. for the same word next to the same word ("a run", "the run");
3. for the same word everywhere, once two fixes agree and none disagree.

Fixes work right away in the teacher's browser. **Shared fixes** (`data/teacher-fixes.json`) work in every project:
the teacher downloads her fixes ("Send my fixes to the engine"), and they are added with `npm run add-fixes <file>`.
Each shared fix is then a test the engine must keep passing.

## 7. Changing a rule (how the curriculum and the engine stay together)

When she and Beth decide a rule in the curriculum, or a sentence is marked wrong anywhere:
1. Write the sentence and every word's correct symbol (and its formula code, if it has one) in `src/writer/engineTests.ts` (or her formula list).
2. Run `npm test`: it shows the sentence failing.
3. Change the rule (sections 3 and 4), in the engine and in this file.
4. Run `npm test` until every check passes, then raise the version number and update each project.

A rule is not changed unless every older test still passes, so a fix for one sentence cannot break another.
