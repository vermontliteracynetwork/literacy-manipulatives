import LiteracyManipulatives from './LiteracyManipulatives';
import { ToolDashboard } from './components/ToolDashboard';
import { WordExplorer } from './components/word-explorer/WordExplorer';
import { FormulaSearch } from './components/FormulaSearch';
import { DailyProcedure } from './components/procedures/DailyProcedure';
import { isJoinRoute } from './lib/share';

// Routes: "/" is the tools dashboard; "/whiteboard", "/write" and "/words" (Word Explorer) "/formulas" (Formula Search) and "/procedure" (Daily Procedure) open the tools themselves.
// "/join" and any page that embeds the board with "?welcome=0" (the Homeplot iframe) still go straight to the board.
function route(): 'dashboard' | 'whiteboard' | 'write' | 'words' | 'formulas' | 'procedure' {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/write') return 'write';
  if (path === '/words') return 'words';
  if (path === '/formulas') return 'formulas';
  if (path === '/procedure') return 'procedure';
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
  return <LiteracyManipulatives startInWriter={r === 'write'} />;
}
