import { stopsOf, type Lesson } from './types';
import { summarize, type Resp } from './check';

// A lesson's reports (her request 2026-11-18): every time the lesson is shared, a copy of each student's answers and
// work, by the name they signed in with. Kept in this browser with the lesson (like the lesson library).

export interface StudentWork { name: string; work: Record<string, { resp: Resp; at: string }> }
export interface Session { id: string; startedAt: string; code: string; students: Record<string, StudentWork> }

const KEY = (lessonId: string) => `lm-lesson-reports-${lessonId}`;
export function readReports(lessonId: string): Session[] {
  try { return JSON.parse(localStorage.getItem(KEY(lessonId)) ?? '[]'); } catch { return []; }
}
export function writeReports(lessonId: string, list: Session[]) {
  try { localStorage.setItem(KEY(lessonId), JSON.stringify(list.slice(-60))); } catch { /* full: kept for this visit */ }
}

export function reportCsv(lesson: Lesson, s: Session): string {
  const stops = stopsOf(lesson);
  const cell = (x: string) => `"${x.replace(/"/g, '""')}"`;
  const rows = [['Student', 'Tab', 'Activity', 'Work', 'Right', 'Out of'].map(cell).join(',')];
  for (const st of Object.values(s.students)) {
    for (const { tab, activity } of stops) {
      const w = st.work[activity.id];
      if (!w) continue;
      const sum = summarize(activity, w.resp);
      rows.push([st.name, tab.title, activity.title, sum.text, sum.right == null ? '' : String(sum.right), sum.total == null ? '' : String(sum.total)].map(cell).join(','));
    }
  }
  return rows.join('\n');
}
