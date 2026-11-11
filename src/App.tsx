import LiteracyManipulatives from './LiteracyManipulatives';
import { ToolDashboard } from './components/ToolDashboard';
import { isJoinRoute } from './lib/share';

// Routes: "/" is the tools dashboard; "/whiteboard" and "/write" open the tools themselves.
// "/join" and any page that embeds the board with "?welcome=0" (the Homeplot iframe) still go straight to the board.
function route(): 'dashboard' | 'whiteboard' | 'write' {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/write') return 'write';
  if (path === '/whiteboard' || isJoinRoute()) return 'whiteboard';
  if (new URLSearchParams(window.location.search).has('welcome')) return 'whiteboard';
  return 'dashboard';
}

export default function App() {
  const r = route();
  if (r === 'dashboard') return <ToolDashboard />;
  return <LiteracyManipulatives startInWriter={r === 'write'} />;
}
