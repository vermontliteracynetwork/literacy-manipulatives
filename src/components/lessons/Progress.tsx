import type { Lesson } from '../../lib/lessons/types';

// Across the top in Present mode (her request 2026-11-18): a progress bar of the whole lesson, so students see what
// is done and what is next, or the same lesson as a checklist when the teacher turns that on.
export function Progress({ lesson, at, done, view, onPick }: { lesson: Lesson; at: string | null; done: string[]; view: 'bar' | 'checklist'; onPick?: (activityId: string) => void }) {
  const tabs = lesson.tabs.filter((t) => t.sections.some((s) => s.activities.length));
  const doneSet = new Set(done);
  if (view === 'checklist') {
    return (
      <ol className="ln-checklist" aria-label="Today's checklist">
        {tabs.map((t) => {
          const acts = t.sections.flatMap((s) => s.activities);
          const all = acts.every((a) => doneSet.has(a.id));
          const here = acts.some((a) => a.id === at);
          return (
            <li key={t.id} className={`${all ? 'done' : ''}${here ? ' here' : ''}`}>
              <span className="ln-box" aria-hidden>{all ? '✓' : ''}</span>
              <span>{t.title}</span>
            </li>
          );
        })}
      </ol>
    );
  }
  return (
    <div className="ln-progress" role="list" aria-label="Lesson progress">
      {tabs.map((t) => {
        const acts = t.sections.flatMap((s) => s.activities);
        const here = acts.some((a) => a.id === at);
        return (
          <div key={t.id} role="listitem" className={`ln-prog-tab${here ? ' here' : ''}${acts.every((a) => doneSet.has(a.id)) ? ' done' : ''}`}>
            <span className="ln-prog-name">{t.title}</span>
            <span className="ln-prog-dots">
              {acts.map((a) => {
                const cls = `ln-prog-dot${a.id === at ? ' here' : ''}${doneSet.has(a.id) ? ' done' : ''}`;
                return onPick
                  ? <button key={a.id} type="button" className={cls} title={a.title} aria-label={`Go to ${a.title}`} onClick={() => onPick(a.id)} />
                  : <span key={a.id} className={cls} title={a.title} />;
              })}
            </span>
          </div>
        );
      })}
    </div>
  );
}
