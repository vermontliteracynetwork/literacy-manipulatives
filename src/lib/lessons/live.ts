import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getClient, joinChannel, studentId } from '../share';
import { forStudents, newCode, type Lesson } from './types';
import type { Resp } from './check';

// A Daily Lesson shared live (her request 2026-11-18). Same Supabase Realtime channels as the whiteboard, so the one
// join page works for both: the teacher's presence says app "lesson", and the join page sends the student here.
// Each lesson keeps its own code. The teacher leads: students see the activity the teacher is on. On an activity
// the teacher opened for students ("Students do it"), each student's work comes back to the teacher live, and it is
// kept in the lesson's report.

export interface Pos { at: string | null; tabId: string | null; teacherResp: Resp; done: string[]; progress: 'bar' | 'checklist' }
export interface LiveStudent { id: string; name: string }
export interface Work { from: string; name: string; activityId: string; resp: Resp }

const channelName = (code: string) => `lm-board-${code}`;
const pause = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

export function useLessonHost(lesson: Lesson, pos: Pos, onWork: (w: Work) => void, onCode: (code: string) => void) {
  const [status, setStatus] = useState<'off' | 'starting' | 'live' | 'error'>('off');
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [students, setStudents] = useState<LiveStudent[]>([]);
  const ch = useRef<RealtimeChannel | null>(null);
  const latest = useRef({ lesson, pos });
  const workRef = useRef(onWork);
  useEffect(() => { latest.current = { lesson, pos }; workRef.current = onWork; });

  const sendLesson = useCallback(() => { void ch.current?.send({ type: 'broadcast', event: 'lesson', payload: forStudents(latest.current.lesson) }); }, []);
  const sendPos = useCallback(() => { void ch.current?.send({ type: 'broadcast', event: 'pos', payload: latest.current.pos }); }, []);

  const start = useCallback(async () => {
    if (ch.current) return;
    setError(null); setStatus('starting');
    const supa = getClient();
    if (!supa) { setError("Sharing isn't set up on this site yet."); setStatus('error'); return; }
    let c = latest.current.lesson.code ?? newCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const channel = supa.channel(channelName(c), { config: { presence: { key: `teacher-${c}` }, broadcast: { self: false } } });
      channel.on('presence', { event: 'sync' }, () => {
        const list: LiveStudent[] = [];
        for (const [key, metas] of Object.entries(channel.presenceState())) {
          const meta = (metas as unknown as { role?: string; name?: string }[])[0];
          if (meta?.role === 'student') list.push({ id: key, name: meta.name || 'Student' });
        }
        setStudents(list);
      });
      channel.on('broadcast', { event: 'hello' }, () => { sendLesson(); sendPos(); });
      channel.on('broadcast', { event: 'work' }, ({ payload }) => workRef.current(payload as Work));
      const problem = await joinChannel(channel);
      if (problem) { await supa.removeChannel(channel); setError(problem); setStatus('error'); return; }
      await pause(700);
      if (Object.keys(channel.presenceState()).some((k) => k.startsWith('teacher-'))) { await supa.removeChannel(channel); c = newCode(); continue; }
      ch.current = channel;
      void channel.track({ role: 'teacher', app: 'lesson' });
      setCode(c); setStatus('live');
      if (c !== latest.current.lesson.code) onCode(c);
      return;
    }
    setError('Every code tried was busy. Press Share again.'); setStatus('error');
  }, [sendLesson, sendPos, onCode]);

  const stop = useCallback(async () => {
    const channel = ch.current; ch.current = null;
    setStatus('off'); setCode(null); setStudents([]);
    if (channel) { await channel.send({ type: 'broadcast', event: 'ended', payload: {} }); await getClient()?.removeChannel(channel); }
  }, []);

  const lessonKey = JSON.stringify(forStudents(lesson));
  useEffect(() => { if (status !== 'live') return; const t = window.setTimeout(sendLesson, 500); return () => window.clearTimeout(t); }, [lessonKey, status, sendLesson]);
  const posKey = JSON.stringify(pos);
  useEffect(() => { if (status !== 'live') return; const t = window.setTimeout(sendPos, 100); return () => window.clearTimeout(t); }, [posKey, status, sendPos]);
  useEffect(() => {
    const bye = () => { void ch.current?.send({ type: 'broadcast', event: 'ended', payload: {} }); };
    window.addEventListener('pagehide', bye);
    return () => { window.removeEventListener('pagehide', bye); const c = ch.current; if (c) void getClient()?.removeChannel(c); };
  }, []);

  return { status, error, code, students, start, stop };
}

export function useLessonStudent() {
  const [status, setStatus] = useState<'idle' | 'checking' | 'ready' | 'joined' | 'not-found' | 'ended' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const [name, setName] = useState('');
  const ch = useRef<RealtimeChannel | null>(null);
  const joined = useRef(false);
  const gone = useRef<number | null>(null);

  const checkCode = useCallback(async (code: string): Promise<boolean> => {
    setError(null);
    const supa = getClient();
    if (!supa) { setStatus('error'); setError("Joining isn't set up yet. Ask your teacher."); return false; }
    setStatus('checking');
    const channel = supa.channel(channelName(code), { config: { presence: { key: studentId }, broadcast: { self: false } } });
    let here = false;
    channel.on('presence', { event: 'sync' }, () => {
      here = Object.keys(channel.presenceState()).some((k) => k.startsWith('teacher-'));
      if (gone.current) { window.clearTimeout(gone.current); gone.current = null; }
      if (!here && joined.current) gone.current = window.setTimeout(() => { if (joined.current) setStatus('ended'); }, 5000);
    });
    channel.on('broadcast', { event: 'lesson' }, ({ payload }) => setLesson(payload as Lesson));
    channel.on('broadcast', { event: 'pos' }, ({ payload }) => setPos(payload as Pos));
    channel.on('broadcast', { event: 'ended' }, () => setStatus('ended'));
    const problem = await joinChannel(channel);
    if (problem) { await supa.removeChannel(channel); setError(problem); setStatus('error'); return false; }
    for (let i = 0; i < 20 && !here; i++) await pause(150);
    if (!here) { await supa.removeChannel(channel); setStatus('not-found'); return false; }
    const host = Object.entries(channel.presenceState()).find(([k]) => k.startsWith('teacher-'))?.[1] as unknown as { app?: string }[] | undefined;
    if (host?.[0]?.app !== 'lesson') { await supa.removeChannel(channel); window.location.assign(`/join`); return false; }
    ch.current = channel;
    setStatus('ready');
    return true;
  }, []);

  const join = useCallback(async (n: string) => {
    const channel = ch.current;
    if (!channel) return;
    setName(n); joined.current = true; setStatus('joined');
    await channel.track({ role: 'student', name: n });
    await channel.send({ type: 'broadcast', event: 'hello', payload: {} });
  }, []);

  const timers = useRef<Record<string, number>>({});
  const sendWork = useCallback((activityId: string, resp: Resp) => {
    window.clearTimeout(timers.current[activityId]);
    timers.current[activityId] = window.setTimeout(() => {
      void ch.current?.send({ type: 'broadcast', event: 'work', payload: { from: studentId, name, activityId, resp } satisfies Work });
    }, 250);
  }, [name]);

  useEffect(() => () => { const c = ch.current; if (c) void getClient()?.removeChannel(c); }, []);
  return { status, error, lesson, pos, name, checkCode, join, sendWork };
}
