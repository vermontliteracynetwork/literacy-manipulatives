import type { Procedure, ProcPage } from './types';
import { emptyBoard, newId } from './types';

// Her Level B Daily Plan, Unit 1 Day 1, lessons 1.1.1 to 1.1.4 (uploaded 2026-11-12), as a Daily Procedure: one
// page per step. Student-facing words are on the page; the Say and Do script is in each page's teacher notes.

const PROMPTS = `Prompt ladder (use the lowest that works):
1 Wait: wait 5 seconds. Say nothing.
2 Point: touch the symbol for the slot. Say nothing.
3 Ask: "What goes here?" Hand: "Who did it?" Arrows: "What did it do?" Triangle: "Which article?" Time: "Yesterday or tomorrow?"
4 Two choices: "Is it jump or jumped?" (one right, one wrong; change the order each time)
5 Model: "Yesterday is in the past, so the Action needs -ed: jumped. Say it with me." Then the learner retries the same item and does one new item.

Error correction (every step): point to the symbol whose slot is wrong, ask the slot question, model if needed, learner retries, then one new item at the same rung.

Self-talk lines (model them; the learner uses all four): "What's my formula? Say it first." "One symbol, one word." "Read it back. Check it." "Slow down. Touch the symbol."

Sentence Check (card): 1 Complete? "Point to the Who part and the Action part." 2 Capital? "Is there a capital at the start?" 3 End mark? "Is there an end mark?" 4 Match? "One Who: does the Action have -s? Many: no -s." 5 Time? "Past, now or future? Is it the same all the way through?" (1.1.4)

You do runs rungs 2 to 5, 2 to 3 items per rung; up after two correct, back one rung after two errors.`;

const page = (p: Omit<ProcPage, 'id' | 'board'> & { board?: ProcPage['board'] }): ProcPage => ({ id: newId(), board: emptyBoard(), ...p });

export function levelBDay1(): Procedure {
  return {
    id: newId(),
    title: 'Level B, Unit 1 Day 1: Lessons 1.1.1 to 1.1.4',
    subtitle: 'Intervention Daily Plan. Level B: 40 to 50 min.',
    folderId: null,
    updatedAt: new Date().toISOString(),
    pages: [
      page({
        title: 'Goal', minutes: '1 to 2 min', kind: 'goal',
        data: {
          agenda: ['Review', 'Learn', 'Practice', 'Do it', 'Check'],
          goal: 'Today I can write sentences that tell who did something, now, yesterday and tomorrow, and put three of them together about one topic.',
          closing: 'By the end, you will write three sentences about one picture.',
        },
        notes: `Do: Show the written agenda: Review, Learn, Practice, Do it, Check.
Say: "Read today's goal to me."
Learner reads the goal.
Say: "By the end, you'll write three sentences about one picture."

Materials (set out before the lesson): formula strips S1.A, S1 and S1.A.V. Symbol cards. Word cards: the, a, an, dog, cat, pig, hen, kid, owl, ant, egg, ran, sat, hid, naps, runs, jumped, will run. -s tile, -ed tile and will card. Picture cards: one dog, many dogs, many cats, many pigs, one pig, an owl, an ant, an egg, a hen. A calendar strip marked yesterday, today, tomorrow. Whiteboard and marker. Sentence Check card. Written agenda. Park photo with dogs. Slot Machine piles (article, Who, Action, time cards). Assessment picture: one dog, three cats and an owl.

Response mode is the learner's choice: whiteboard, typing, tiles or scribe. Level B whispers the sentence before writing it.
Teach the next formula only after the learner passes the check for the one before. Anything not reached moves to Day 2.`,
      }),
      page({
        title: 'Review symbols', minutes: '5 to 8 min', kind: 'review-symbols',
        data: {
          directions: ['Name it.', 'Show the motion.', 'Give me a word.', 'Sort the word cards under their symbols.', 'Speed sort: 30 seconds. Ready, go.'],
          symbols: [
            { cls: 'article', motion: 'Triangle with two hands', words: ['the', 'a', 'an'] },
            { cls: 'noun', motion: 'Point', words: ['dog', 'cat', 'pig', 'hen', 'kid', 'owl', 'ant', 'egg'] },
            { cls: 'verb', motion: 'Crossed pointer fingers in small circles', words: ['ran', 'sat', 'hid', 'naps', 'runs', 'jumped', 'will run'] },
          ],
          timerSeconds: 30,
        },
        notes: `For each symbol: name, motion, word. Review is errorless: say it with the learner and move on.
Article (pink triangle): "Name it." (article) "Give me an article word."
Noun (red hand): "Name it." (noun, the Who) "Give me a Who."
Verb (green arrows): "Name it." (verb, the Action) "Give me an Action."
Say: "Sort the word cards under their symbols."
Say: "Now a speed sort. You have 30 seconds. Ready, go."
Do: Time it. Note the number sorted correctly; beat it next time.`,
      }),
      page({
        title: '1.1.1 The + Who + Action', minutes: '5 to 8 min', kind: 'formula',
        data: {
          lesson: '1.1.1', name: 'The + Who + Action', codes: ['S1.A'],
          blocks: [
            { label: 'I do', lines: ['The dog ran.', 'The cat sat.'] },
            { label: 'Not the formula', lines: ['Dog ran. The article slot is empty. Fix: The dog ran.', 'The dog. No Action. Fix: The dog sat.'] },
            { label: 'We do', lines: ['The pig hid.', 'Circle the Who part. Underline the Action part.'] },
            { label: 'You do', lines: ['Rung 2: The ___ ran.', 'Rung 3: The ___ ___.', 'Rung 4: symbols only (triangle, hand, arrows)', 'Rung 5: The + Who + Action', 'Whisper it first. Write it. Read it back. Check it.'] },
            { label: 'Check', lines: ['Write a sentence about the dog.', 'Write a sentence about the kid.'] },
          ],
        },
        notes: `Say: "Today's first formula is The + Who + Action. Writers use it to tell who did something. Article, noun, verb."
Do: Touch each symbol on the strip as you name it.
I do. Say: "Article first: The. Noun, the Who: dog. Verb, the Action: ran. The dog ran. Capital at the start, period at the end. Another: The cat sat."
Say: "Not the formula: Dog ran. The article slot is empty. Fix: The dog ran. And The dog. No Action. Fix: The dog sat."
We do: The pig hid. "Article?" (The) "Who?" (pig) "What did it do?" (hid) "Write it on the whiteboard. Circle the Who part, underline the Action part."
Check: "No help this time. Write a sentence about the dog. Now one about the kid."
Decide: both correct, go to 1.1.2. Otherwise reteach with the prompt ladder and give 2 new items. After two reteach rounds, stop and continue on Day 2.

${PROMPTS}`,
      }),
      page({
        title: '1.1.2 One or many', minutes: '5 to 8 min', kind: 'formula',
        data: {
          lesson: '1.1.2', name: 'One or many', codes: ['S1'],
          blocks: [
            { label: 'I do', lines: ['One dog: The dog runs.', 'Many dogs: Dogs run.'] },
            { label: 'Not right', lines: ['Dogs runs. Two -s endings. Fix: Dogs run.'] },
            { label: 'We do', lines: ['Cats sit.', 'One or many? Where does the -s go? Action?'] },
            { label: 'You do', lines: ['Rung 2: ___ run. (many hens)', 'Rung 3: ___ ___. (many pigs)', 'Rungs 4 and 5: symbols only, then formula only', 'Switch: now make it one. What moves?'] },
            { label: 'Check', lines: ['Write a sentence for this picture: many cats.', 'Write a sentence for this picture: one pig.'] },
          ],
        },
        notes: `Say: "Next formula: Who + Action, for many. Writers use it when there is more than one. Noun, verb, no article."
I do. Do: Show the one-dog picture; write The dog runs. Underline the -s on runs. Say: "One dog: the Action gets the -s. The dog runs."
Do: Show the many-dogs picture; move the -s tile to dog, erase The. Say: "Many dogs: the Who gets the -s and the Action loses it. Dogs run."
Say: "Not right: Dogs runs. Two -s endings. Many dogs, so the Action has no -s. Fix: Dogs run."
We do: Cats sit. "One or many?" (many) "Where does the -s go?" (on the Who: cats) "Action?" (sit)
You do: rung 2, ___ run. with the many-hens picture; rung 3, ___ ___. with the many-pigs picture; rungs 4 and 5, symbols only then formula only: "Write a many sentence of your own." Switch: "Now make it one. What moves?" (the -s moves to the Action and The comes back)
Check: Item 1, many-cats picture (Cats nap.). Item 2, one-pig picture (The pig naps.). Decide as for 1.1.1.

${PROMPTS}`,
      }),
      page({
        title: '1.1.3 a, an, the', minutes: '5 to 8 min', kind: 'formula',
        data: {
          lesson: '1.1.3', name: 'a, an, the', codes: ['S1.A'],
          blocks: [
            { label: 'I do', lines: ['A dog naps.', 'An owl naps.'] },
            { label: 'Not right', lines: ['A owl naps. Owl starts with a vowel sound. Fix: An owl naps.'] },
            { label: 'We do: a or an?', lines: ['ant', 'cat', 'egg', 'pig', 'owl'] },
            { label: 'You do', lines: ['___ owl sat.', '___ dog ran.', '___ egg hid.', '___ kid naps.', 'Now write two of your own: one with a, one with an.'] },
            { label: 'Check', lines: ['Write a sentence for this picture: an ant.', 'Write a sentence for this picture: a pig.'] },
          ],
        },
        notes: `Say: "A, an and the are all articles. They go under the triangle. Use an before a word that starts with a vowel sound, like owl. Use a before other sounds, like dog. Use the when we know which one."
I do. Say: "A dog naps. An owl naps. Say a owl: it's hard to say. An owl is easy."
Say: "Not right: A owl naps. Owl starts with a vowel sound. Fix: An owl naps."
We do. Say: "A or an? Say it out loud first." ant: an. cat: a. egg: an. pig: a. owl: an.
You do (mixed a, an, the). Say: "Fill in the article. Whisper each one first, then read them back." Answers: an owl sat; a or the dog ran; an egg hid; a or the kid naps.
Check: Item 1, ant picture (An ant ran.). Item 2, pig picture (A pig sat.). Decide as for 1.1.1.

${PROMPTS}`,
      }),
      page({
        title: '1.1.4 Yesterday and tomorrow', minutes: '5 to 8 min', kind: 'formula',
        data: {
          lesson: '1.1.4', name: 'Yesterday and tomorrow', codes: ['S1.A', 'S1.A.V'],
          blocks: [
            { label: 'I do', lines: ['Yesterday the dog jumped.', 'The cat sat.', 'Tomorrow the dog will run.'] },
            { label: 'Not right', lines: ['Yesterday the dog jump. Fix: Yesterday the dog jumped.'] },
            { label: 'We do: yesterday or tomorrow?', lines: ['Yesterday the pig walked.', 'Tomorrow the hen will sit.'] },
            { label: 'You do', lines: ['The dog ___ yesterday.', 'The dog will ___.', 'Switch: move your sentence to yesterday. Now move it to tomorrow. What changed?'] },
            { label: 'Check', lines: ['Write one sentence about yesterday.', 'Write one sentence about tomorrow.'] },
            { label: 'Close', lines: ["Tell me today's formulas and touch the symbols.", 'Say one sentence for yesterday and one for tomorrow.'] },
          ],
        },
        notes: `Do: Lay the calendar strip next to the formula strips. Add the S1.A.V strip (triangle, hand, will, arrows).
Say: "Sentences can tell when. Yesterday is in the past. Tomorrow is in the future. The Action changes to show the time."
I do. Do: Point to yesterday on the calendar. Write Yesterday the dog jumped. Add the -ed tile. Say: "Yesterday is in the past, so the Action gets -ed: jump, jumped. Yesterday the dog jumped." Say: "Some Actions have their own past word: sit becomes sat. The cat sat."
Do: Point to tomorrow. Write Tomorrow the dog will run. Place the will card. Say: "Tomorrow is in the future, so I add will before the Action. After will, the Action has no -s and no -ed: will run."
Say: "Not right: Yesterday the dog jump. Yesterday is the past, so I need -ed. Fix: Yesterday the dog jumped."
We do. Say: "Yesterday or tomorrow?" Do: Point to a day on the calendar. The learner chooses the -ed tile or the will card. Build together: Yesterday the pig walked. Tomorrow the hen will sit.
You do: rung 2 (yesterday) The dog ___ yesterday. "Whisper it. Write it. Read it back. Check it, including Time." (jumped, played, walked, sat). Rung 2 (tomorrow) The dog will ___. (run, sit, jump). Switch: the learner's own sentence from 1.1.1: "Move it to yesterday. Now move it to tomorrow. What changed?"
Check: "Write one sentence about yesterday and one about tomorrow." Both correct, go to Practice. Otherwise reteach and continue on Day 2.
Close (1 minute): "Tell me today's formulas and touch the symbols. Then say one sentence for yesterday and one for tomorrow."

${PROMPTS}`,
      }),
      page({
        title: 'Practice', minutes: '5 to 10 min', kind: 'activity', phase: 'Practice',
        data: {
          directions: ['Practice together', 'Choice 1: Picture writing. Three sentences about one picture: one with the, one with many, and one with yesterday or tomorrow.', 'Who is in the picture? What is happening? Say it, write it, read it back.', 'Choice 2: Sentence edits. Each sentence has two mistakes. Find them and fix them.'],
          examples: ['Example set: The dog ran. Dogs play. Tomorrow the kid will walk.', 'dog ran', 'dogs runs', 'a owl sat', 'yesterday the cat jump'],
          piles: [],
        },
        board: {
          strokes: [],
          placed: [
            { instanceId: newId(), kind: 'textbox', x: 60, y: 40, fontSize: 28, textValue: 'Write three sentences about the park: one with the, one with many, and one with yesterday or tomorrow.' },
            { instanceId: newId(), kind: 'checklist', x: 60, y: 220, checkTitle: 'Sentence Check', checkLines: [
              { id: newId(), text: 'Complete (Who and Action)' }, { id: newId(), text: 'Capital at the start' }, { id: newId(), text: 'End mark' },
              { id: newId(), text: 'Match (one or many)' }, { id: newId(), text: 'Time (past, now or future)' },
            ] },
          ],
        },
        notes: `Select an activity where student and teacher practice together.
Choice 1: Picture writing, three sentences on one topic (Procedure C).
Do: Open this step's Whiteboard (top bar) and insert the park photo with dogs (Insert > Insert a picture). The whiteboard already has the writing directions and a Sentence Check list. Hand over the picture planning card: Who, what is happening, say it, write it, read it back.
Say: "Who is in the picture?" (dogs, a dog, a kid...) "What is happening?"
Say: "Write three sentences about the park, one for each formula: one with the, one with many, and one with yesterday or tomorrow. Whisper each sentence first."
Example set: The dog ran. Dogs play. Tomorrow the kid will walk.
Say: "Read all three back. Check each one."
Choice 2: Sentence edits (two errors per card). Say: "Each sentence has two mistakes. Find them and fix them."
dog ran: The dog ran. dogs runs: Dogs run. a owl sat: An owl sat. yesterday the cat jump: Yesterday the cat jumped.`,
      }),
      page({
        title: 'Application', minutes: '5 to 15 min', kind: 'activity', phase: 'Application',
        data: {
          directions: ['Sentence Slot Machine', 'Flip one card from each pile.', 'Fix it so it is a real sentence: check one or many, a or an, and the time.', 'Read it back. Check it.'],
          examples: ['a + owl + run + tomorrow: An owl will run.'],
          piles: [
            { label: 'Article', cards: ['the', 'a', 'an'] },
            { label: 'Who', cards: ['dog', 'cat', 'pig', 'hen', 'kid', 'owl', 'ant', 'dogs', 'cats', 'pigs'] },
            { label: 'Action', cards: ['run', 'sit', 'hide', 'nap', 'jump', 'walk', 'play'] },
            { label: 'Time', cards: ['yesterday', 'now', 'tomorrow'] },
          ],
        },
        notes: `Independent or less-support reinforcement activity.
Do: Make four face-down piles: article, Who, Action, time (yesterday, now, tomorrow). (The piles on this page flip a card at random.)
Say: "Flip one card from each pile. Then fix it so it's a real sentence: check one or many, a or an, and the time."
Example flip: a + owl + run + tomorrow: the learner writes An owl will run.
Say: "Read it back. Check it. Your turn again."
Do 4 to 5 rounds. The learner works on their own; step in only with the prompt ladder.
Other choice: Plan-my-week. Three will sentences about real plans for a pet or family member, named with The + Who (Tomorrow the baby will nap.). I and names come later (1.2 and 1.3).`,
      }),
      page({
        title: 'Assessment', minutes: '5 to 10 min', kind: 'assessment',
        data: {
          intro: 'In the picture there are: one dog, three cats and an owl.',
          items: [
            { prompt: 'Write a sentence about the dog.', skill: '1.1.1', answer: 'The dog ran.' },
            { prompt: 'Write a sentence about the cats.', skill: '1.1.2', answer: 'Cats sit.' },
            { prompt: 'Write a sentence about the owl.', skill: '1.1.3', answer: 'An owl naps.' },
            { prompt: 'Write what the dog did yesterday.', skill: '1.1.4', answer: 'Yesterday the dog jumped.' },
            { prompt: 'Write what the cats will do tomorrow.', skill: '1.1.4', answer: 'Tomorrow the cats will run.' },
          ],
          checks: ['Formula', 'Capital', 'End mark'],
        },
        notes: `Formative assessment. Do: Show the new picture: one dog, three cats and an owl. Do not model.
Correct answers: any Action that fits.
Use the result: all correct, Day 2 starts with review only for these skills. One error, reteach that formula in Day 2's Instruction. Two or more, repeat Day 1 Instruction for the missed formulas.
Record: score ___ / 5, highest prompt used ___, response mode (H, C, T, S) ___.
Say: "Pick one Sentence Check item to work on next time and write it on your tracker."`,
      }),
    ],
  };
}
