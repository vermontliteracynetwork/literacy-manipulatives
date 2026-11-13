import LiteracyManipulatives from './LiteracyManipulatives';
import { ToolDashboard } from './components/ToolDashboard';
import { WordExplorer } from './components/word-explorer/WordExplorer';
import { FormulaSearch } from './components/FormulaSearch';
import { DailyProcedure } from './components/procedures/DailyProcedure';
import { WordListsApp } from './components/WordListsApp';
import { PassageBuilder } from './components/PassageBuilder';
import { isJoinRoute } from './lib/share';

// Routes: "/" is the tools dashboard; "/whiteboard", "/write" and "/words" (Word Explorer) "/formulas" (Formula Search) and "/procedure" (Daily Procedure) "/lists" (Word List Maker) and "/passages" (Passage Builder) open the tools themselves.
// "/join" and any page that embeds the board with "?welcome=0" (the Homeplot iframe) still go straight to the board.
function route(): 'dashboard' | 'whiteboard' | 'write' | 'words' | 'formulas' | 'procedure' | 'lists' | 'passages' {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/write') return 'write';
  if (path === '/words') return 'words';
  if (path === '/formulas') return 'formulas';
  if (path === '/procedure') return 'procedure';
  if (path === '/lists') return 'lists';
  if (path === '/passages') return 'passages';
  if (path === '/whiteboard' || isJoinRoute()) return 'whiteboard';
  if (new URLSearchParams(window.location.search).has('welcome')) return 'whiteboard';
  return 'dashboard';
}

export default function App() {
  const r = route();
  if (r === 'dashboard') return <ToolDashboard />;
  if (r === 'words') return <WordExplorer />;
  if (r === 'formulas') return <FormulaSearch />;
  if (r === 'procedure') return <DailyProcedure />;
  if (r === 'lists') return <WordListsApp />;
  if (r === 'passages') return <PassageBuilder />;
  return <LiteracyManipulatives startInWriter={r === 'write'} />;
}
