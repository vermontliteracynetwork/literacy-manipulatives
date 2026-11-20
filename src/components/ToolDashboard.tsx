import { useMemo, useState } from 'react';

// The tools dashboard (her request 2026-11-11): every Symbolic Grammar tool as a card. Add a tool by adding a row here.
interface Tool {
  title: string;
  description: string;
  href: string;
  image: string;
  tags: string[];
}

const TOOLS: Tool[] = [
  {
    title: 'Whiteboard',
    description: 'An open drag-and-drop board with grammar symbols, symbol sentences, morphemes, letter tiles and a pen. Share it with a class code.',
    href: '/whiteboard?welcome=0',
    image: '/dashboard/whiteboard.png',
    tags: ['Student-facing', 'Teacher tool'],
  },
  {
    title: 'Word Processor',
    description: 'Write mode: type sentences and see each word’s grammar symbol, with sentence formulas, spelling help and read-aloud.',
    href: '/write',
    image: '/dashboard/word-processor.png',
    tags: ['Student-facing', 'Writing'],
  },
  {
    title: 'Word Explorer',
    description: 'A dictionary and thesaurus: hear a word, see what it means with her grammar symbols, and hop to words like it. Word Jobs shows every word that can be more than one part of speech, with the rule for telling them apart.',
    href: '/words',
    image: '/dashboard/word-explorer.png',
    tags: ['Student-facing', 'Vocabulary'],
  },
  {
    title: 'Word List Maker',
    description: 'Build word lists by spelling pattern, syllable type, word part, part of speech, Tier, topic and more. Save, print cards, or assign with a link.',
    href: '/lists',
    image: '/dashboard/word-lists.png',
    tags: ['Teacher tool', 'Student-facing', 'Phonics'],
  },
  {
    title: 'Formula Search',
    description: 'Type any sentence to find its formulas, or Log Formulas: paste a passage (student writing or public domain) and every sentence is logged by its formula in one table.',
    href: '/formulas',
    image: '/dashboard/formula-search.png',
    tags: ['Teacher tool', 'Formulas'],
  },
  {
    title: 'Daily Lesson',
    description: 'Build a lesson in tabs (Goal, Review, Instruction, Practice, Assessment), each holding activity cards from the Practice Activities Bank. Present it full screen; students join with the lesson\'s code, follow along on their iPads and do the activities you open for them. See their work live and keep a report.',
    href: '/procedure',
    image: '/dashboard/daily-procedure.png',
    tags: ['Teacher tool', 'Lessons'],
  },
  {
    title: 'Assessment Scoring',
    description: 'Score a Symbolic Grammar assessment online (Unit 1, Levels A, B and C). Totals, percents, target scores and what to teach fill in as you type. Track growth from pretest to posttest.',
    href: '/scoring',
    image: '/dashboard/assessment-scoring.svg',
    tags: ['Teacher tool', 'Assessment'],
  },
  {
    title: 'Silly Stories',
    description: 'Mad Libs style silly stories: open one and play right away. To set the stories and words, edit a deck: pick which parts of speech students fill in and how many (3 adjectives, 2 verbs...), and the grammar engine finds those words in the story. Build a deck, share its code, and students fill in their words and read their silly stories.',
    href: '/silly-stories',
    image: '/dashboard/silly-stories.svg',
    tags: ['Student-facing', 'Teacher tool', 'Parts of speech'],
  },
  {
    title: 'Story Maker',
    description: 'Build sentences from the formulas and grammar symbols, Mad Lib style, and watch a pixel video act out what the words mean. Add sentences to make a story, play it aloud and save it as a video.',
    href: '/story',
    image: '/dashboard/story-maker.svg',
    tags: ['Student-facing', 'Teacher tool', 'Formulas'],
  },
];

export function ToolDashboard() {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TOOLS;
    return TOOLS.filter((t) => [t.title, t.description, ...t.tags].join(' ').toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="td-page">
      <header className="td-header">
        <h1>Literacy Manipulatives</h1>
        <p>Tools for the Symbolic Grammar program</p>
      </header>
      <main className="td-main">
        <label className="td-label" htmlFor="td-search">Search tools</label>
        <input
          id="td-search"
          className="td-search"
          type="search"
          placeholder={'Try “writing” or “symbols”'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <p className="td-count">{shown.length} {shown.length === 1 ? 'tool' : 'tools'}</p>
        <ul className="td-grid">
          {shown.map((t) => (
            <li key={t.title}>
              <a className="td-card" href={t.href}>
                <div className="td-thumb"><img src={t.image} alt="" loading="lazy" /></div>
                <div className="td-body">
                  <h2>{t.title}</h2>
                  <p>{t.description}</p>
                  <div className="td-tags">{t.tags.map((g) => <span key={g} className="td-tag">{g}</span>)}</div>
                </div>
              </a>
            </li>
          ))}
        </ul>
        {shown.length === 0 && <p className="td-empty">No tools match that search.</p>}
      </main>
    </div>
  );
}
