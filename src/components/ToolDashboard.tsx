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
    description: 'A dictionary and thesaurus: hear a word, see what it means with her grammar symbols, and hop to words like it.',
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
    description: 'Type any sentence to find its formulas, or mark up a whole passage (student writing or public domain) with the grammar symbols and a formula code for every sentence. New formulas go to the formula log.',
    href: '/formulas',
    image: '/dashboard/formula-search.png',
    tags: ['Teacher tool', 'Formulas'],
  },
  {
    title: 'Daily Procedure',
    description: 'A lesson as steps, one page each: Goal, Review symbols, each formula, Practice and Assessment. Edit it, then present it in Learn mode while you share your screen. Save it in folders.',
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
