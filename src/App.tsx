import LiteracyManipulatives from './LiteracyManipulatives';
import { ToolDashboard } from './components/ToolDashboard';
import { WordExplorer } from './components/word-explorer/WordExplorer';
import { FormulaSearch } from './components/FormulaSearch';
import { DailyLesson } from './components/lessons/DailyLesson';
import { LessonJoin } from './components/lessons/LessonJoin';
import { WordListsApp } from './components/WordListsApp';
import { AssessmentScoring } from './components/assessment/AssessmentScoring';
import { StoryMaker } from './components/story/StoryMaker';
import { isJoinRoute } from './lib/share';

// Routes: "/" is the tools dashboard; "/whiteboard", "/write" and "/words" (Word Explorer) "/formulas" (Formula Search) and "/procedure" (Daily Procedure) and "/lists" (Word List Maker) and "/scoring" (Assessment Scoring) and "/story" (Story Maker) open; "/passages" opens Formula Search on its passage tab the tools themselves.
// "/join" and any page that embeds the board with "?welcome=0" (the Homeplot iframe) still go straight to the board.
function route(): 'dashboard' | 'whiteboard' | 'write' | 'words' | 'formulas' | 'procedure' | 'lesson' | 'lists' | 'scoring' | 'story' {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/write') return 'write';
  if (path === '/words') return 'words';
  if (path === '/formulas') return 'formulas';
  if (path === '/procedure' || path === '/lessons') return 'procedure';
  if (path === '/lesson') return 'lesson';
  if (path === '/lists') return 'lists';
  if (path === '/scoring') return 'scoring';
  if (path === '/story') return 'story';
  // Word Jobs is part of Word Explorer now (her request 2026-11-18); old links still work.
  if (path === '/word-jobs') { window.location.replace('/words?view=jobs'); return 'words'; }
  if (path === '/passages') return 'formulas';
  if (path === '/whiteboard' || isJoinRoute()) return 'whiteboard';
  if (new URLSearchParams(window.location.search).has('welcome')) return 'whiteboard';
  return 'dashboard';
}

export default function App() {
  const r = route();
  if (r === 'dashboard') return <ToolDashboard />;
  if (r === 'words') return <WordExplorer />;
  if (r === 'formulas') return <FormulaSearch />;
  if (r === 'procedure') return <DailyLesson />;
  if (r === 'lesson') return <LessonJoin />;
  if (r === 'lists') return <WordListsApp />;
  if (r === 'scoring') return <AssessmentScoring />;
  if (r === 'story') return <StoryMaker />;
  return <LiteracyManipulatives startInWriter={r === 'write'} />;
}
