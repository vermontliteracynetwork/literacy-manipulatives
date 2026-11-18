import './lessons.css';
import { useEffect, useState } from 'react';
import { loadEngine } from 'symbolic-grammar-engine';
import { ActivityView } from './Activities';
import { Progress } from './Progress';
import { Fit } from './Fit';
import { useLessonStudent } from '../../lib/lessons/live';
import { stopsOf, type Lesson, type Stop } from '../../lib/lessons/types';
import type { Resp } from '../../lib/lessons/check';

// A student in a Daily Lesson (her request 2026-11-18), on an iPad first: they come here from the join page with
// the lesson's code and sign in with their name. The screen follows the teacher. On an activity the teacher opened
// for them they work on it themselves, and their work goes to the teacher live (and into the lesson's report);
// otherwise they watch what the teacher shows.

const WORK_KEY = 'lm-lesson-work';
const readWork = (): Record<string, Resp> => { try { return JSON.parse(sessionStorage.getItem(WORK_KEY) ?? '{}'); } catch { return {}; } };

export function LessonJoin() {
  const s = useLessonStudent();
  const fromUrl = new URLSearchParams(window.location.search).get('code') ?? '';
  const [code, setCode] = useState(fromUrl.replace(/\D/g, '').slice(0, 4));
  const [name, setName] = useState('');
  const [work, setWork] = useState<Record<string, Resp>>(readWork);
  const [, setReady] = useState(0);
  // Each time the teacher moves to an activity a student already worked on, their work goes to the teacher again.
  const at = s.pos?.at ?? null;
  useEffect(() => { if (at && work[at]) s.sendWork(at, work[at], true); }, [at]);
  useEffect(() => { document.title = 'Lesson'; void loadEngine().then(() => setReady((n) => n + 1)).catch(() => undefined); }, []);
  useEffect(() => { if (fromUrl && code.length === 4) void s.checkCode(code); }, []);
  useEffect(() => { try { sessionStorage.setItem(WORK_KEY, JSON.stringify(work)); } catch { /* kept in memory */ } }, [work]);

  if (s.status === 'ended') return <div className="ln-join"><div className="ln-join-card"><h1>The lesson is over</h1><p>Great work today.</p><a className="btn btn-primary ln-big" href="/join">Join again</a></div></div>;
  if (s.status === 'waiting') return <div className="ln-join"><div className="ln-join-card"><h1>Waiting for your teacher...</h1><p>Stay here. The lesson comes back when your teacher does.</p></div></div>;
  if (s.status !== 'joined') {
    const ready = s.status === 'ready';
    return (
      <div className="ln-join">
        <div className="ln-join-card">
          <h1>Join the lesson</h1>
          {!ready ? (
            <form onSubmit={(e) => { e.preventDefault(); if (code.length === 4) void s.checkCode(code); }}>
              <input className="ln-join-in" inputMode="numeric" autoComplete="off" maxLength={4} placeholder="Code" aria-label="Code" value={code} autoFocus onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))} />
              <button type="submit" className="btn btn-primary ln-big" disabled={code.length !== 4 || s.status === 'checking'}>{s.status === 'checking' ? 'Looking...' : 'Next'}</button>
            </form>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) void s.join(name.trim().slice(0, 24)); }}>
              <input className="ln-join-in" placeholder="Your name" aria-label="Your name" value={name} maxLength={24} autoFocus onChange={(e) => setName(e.target.value)} />
              <button type="submit" className="btn btn-primary ln-big" disabled={!name.trim()}>Join</button>
            </form>
          )}
          {s.status === 'not-found' && <p className="ln-join-msg">No lesson with that code right now. Check the code with your teacher.</p>}
          {s.status === 'error' && <p className="ln-join-msg">{s.error ?? "Couldn't connect. Check the internet and try again."}</p>}
        </div>
      </div>
    );
  }

  const lesson = s.lesson;
  const pos = s.pos;
  const stop = lesson && pos?.at ? stopsOf(lesson).find((x) => x.activity.id === pos.at) : undefined;
  if (!lesson || !stop || !pos) return <div className="ln-join"><div className="ln-join-card"><h1>Hi, {s.name}!</h1><p>Your teacher will start the lesson soon.</p></div></div>;
  return <StudentScreen lesson={lesson} stop={stop} done={pos.done} progress={pos.progress} teacherResp={pos.teacherResp}
    resp={work[stop.activity.id] ?? {}} setResp={(r) => { setWork((w) => ({ ...w, [stop.activity.id]: r })); s.sendWork(stop.activity.id, r); }} />;
}

// What a student sees on their iPad. The teacher's "Preview as student" shows this same screen.
export function StudentScreen({ lesson, stop, done, progress, teacherResp, resp, setResp }: {
  lesson: Lesson; stop: Stop; done: string[]; progress: 'bar' | 'checklist'; teacherResp: Resp; resp: Resp; setResp: (r: Resp) => void;
}) {
  const a = stop.activity;
  const mine = a.access === 'do';
  const quiet = stop.tab.kind === 'assessment';
  return (
    <div className="ln ln-student">
      <Progress lesson={lesson} at={a.id} done={done} view={progress} />
      <p className={`ln-turn ${mine ? 'do' : 'watch'}`} role="status">{mine ? 'Your turn' : 'Watch and follow along'}</p>
      <main className="ln-stage ln-stage-fit" aria-label={a.title}>
       <Fit>
        <h1 className="ln-stage-title"><span className="ln-stage-tab">{stop.tab.title}</span> {a.title}</h1>
        {mine
          ? <ActivityView key={a.id} a={a} lesson={lesson} quiet={quiet} resp={resp} interactive set={setResp} />
          : <ActivityView key={a.id} a={a} lesson={lesson} quiet={quiet} resp={teacherResp} interactive={false} set={() => {}} />}
       </Fit>
      </main>
    </div>
  );
}
