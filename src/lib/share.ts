import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';

// Live sharing (her request 2026-10-15): the teacher presses Share and gets a 4-digit code; students open the
// join link, type the code and their name, and land on the teacher's board. The teacher sees each student by
// name with a view (👁) or edit (✏️) switch. Edit students can move pieces; view students only watch. The
// teacher always has edit access, and the teacher's board is the one true copy.
//
// Built on Supabase Realtime channels only (broadcast + presence), so it needs no database tables: just a
// Supabase project's URL and public anon key in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Without them the
// Share button explains that setup isn't finished. Nothing is saved anywhere: a shared board lives only as
// long as the teacher's tab does, same as the unshared board.

// Accepts the full Project URL or just the project ID (e.g. "qjjbaxfjmwawcmtigeba"), since both get pasted.
const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const url = rawUrl && !rawUrl.includes('://') ? `https://${rawUrl.replace(/\.supabase\.co\/?$/, '')}.supabase.co` : rawUrl;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const shareConfigured = !!(url && anonKey);

let client: SupabaseClient | null = null;
function getClient(): SupabaseClient | null {
  if (!shareConfigured) return null;
  client ??= createClient(url!, anonKey!, { auth: { persistSession: false } });
  return client;
}

export type Access = 'view' | 'edit';
export interface SharedStudent { id: string; name: string }
export interface Snapshot<P, S> { placed: P[]; strokes: S[]; access: Record<string, Access> }
// A student's edits, sent as changes against the last board they saw so two students moving different pieces
// at once never undo each other.
export interface Ops<P, S> { from: string; upserts: P[]; removes: string[]; strokeAdds: S[]; strokeRemoves: string[] }

const channelName = (code: string) => `lm-board-${code}`;
const newCode = () => String(1000 + Math.floor(Math.random() * 9000));
const BROADCAST_EVERY_MS = 80;

// ---------- Teacher ----------
export function useHostSession<P extends { instanceId: string }, S extends { id: string }>(
  placed: P[], strokes: S[], applyOps: (ops: Ops<P, S>) => void,
) {
  const [code, setCode] = useState<string | null>(null);
  const [students, setStudents] = useState<SharedStudent[]>([]);
  const [access, setAccess] = useState<Record<string, Access>>({});
  const [status, setStatus] = useState<'off' | 'starting' | 'live' | 'error'>('off');
  const channelRef = useRef<RealtimeChannel | null>(null);
  const accessRef = useRef(access);
  const applyRef = useRef(applyOps);
  const latest = useRef({ placed, strokes, access });
  useEffect(() => { accessRef.current = access; applyRef.current = applyOps; latest.current = { placed, strokes, access }; });

  const sendSnapshot = useCallback(() => {
    const ch = channelRef.current;
    if (!ch) return;
    const snap: Snapshot<P, S> = latest.current;
    void ch.send({ type: 'broadcast', event: 'state', payload: snap });
  }, []);

  const start = useCallback(async () => {
    const supa = getClient();
    if (!supa || channelRef.current) return;
    setStatus('starting');
    // Pick a code no other teacher is using right now.
    for (let attempt = 0; attempt < 6; attempt++) {
      const c = newCode();
      const ch = supa.channel(channelName(c), { config: { presence: { key: `teacher-${c}` }, broadcast: { self: false } } });
      const taken = await new Promise<boolean>((resolve) => {
        let settled = false;
        ch.on('presence', { event: 'sync' }, () => {
          if (settled) return;
          settled = true;
          resolve(Object.keys(ch.presenceState()).some((k) => k.startsWith('teacher-')));
        });
        ch.subscribe((s) => { if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') { settled = true; resolve(true); } });
        window.setTimeout(() => { if (!settled) { settled = true; resolve(false); } }, 2500);
      });
      if (taken) { await supa.removeChannel(ch); continue; }
      ch.on('presence', { event: 'sync' }, () => {
        const list: SharedStudent[] = [];
        for (const [key, metas] of Object.entries(ch.presenceState())) {
          const meta = (metas as unknown as { role?: string; name?: string }[])[0];
          if (meta?.role === 'student') list.push({ id: key, name: meta.name || 'Student' });
        }
        setStudents(list);
      });
      ch.on('broadcast', { event: 'hello' }, () => sendSnapshot());
      ch.on('broadcast', { event: 'ops' }, ({ payload }) => {
        const ops = payload as Ops<P, S>;
        if (accessRef.current[ops.from] === 'edit') applyRef.current(ops);
      });
      await ch.track({ role: 'teacher' });
      channelRef.current = ch;
      setCode(c);
      setStatus('live');
      return;
    }
    setStatus('error');
  }, [sendSnapshot]);

  const stop = useCallback(async () => {
    const ch = channelRef.current;
    channelRef.current = null;
    setCode(null);
    setStudents([]);
    setAccess({});
    setStatus('off');
    if (ch) {
      await ch.send({ type: 'broadcast', event: 'ended', payload: {} });
      await getClient()?.removeChannel(ch);
    }
  }, []);

  // Every change to the board (or to who may edit) goes out to the students, a few times a second at most.
  useEffect(() => {
    if (status !== 'live') return;
    const t = window.setTimeout(sendSnapshot, BROADCAST_EVERY_MS);
    return () => window.clearTimeout(t);
  }, [placed, strokes, access, students, status, sendSnapshot]);

  useEffect(() => () => { const ch = channelRef.current; if (ch) void getClient()?.removeChannel(ch); }, []);

  const setStudentAccess = (id: string, a: Access) => setAccess((m) => ({ ...m, [id]: a }));
  return { code, students, access, status, start, stop, setStudentAccess };
}

// ---------- Student ----------
const studentId = (() => {
  try {
    const existing = sessionStorage.getItem('lm-student-id');
    if (existing) return existing;
    const id = `s-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem('lm-student-id', id);
    return id;
  } catch {
    return `s-${Math.random().toString(36).slice(2, 10)}`;
  }
})();

export function useStudentSession<P extends { instanceId: string }, S extends { id: string }>(
  onSnapshot: (snap: Snapshot<P, S>) => void,
) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'joined' | 'not-found' | 'ended' | 'error'>('idle');
  const [access, setAccess] = useState<Access>('view');
  const [name, setName] = useState('');
  const channelRef = useRef<RealtimeChannel | null>(null);
  const snapRef = useRef(onSnapshot);
  useEffect(() => { snapRef.current = onSnapshot; });

  // Step 1: is a teacher sharing with this code right now?
  const checkCode = useCallback(async (code: string): Promise<boolean> => {
    const supa = getClient();
    if (!supa) { setStatus('error'); return false; }
    setStatus('checking');
    const ch = supa.channel(channelName(code), { config: { presence: { key: studentId }, broadcast: { self: false } } });
    const found = await new Promise<boolean>((resolve) => {
      let settled = false;
      ch.on('presence', { event: 'sync' }, () => {
        if (settled) return;
        if (Object.keys(ch.presenceState()).some((k) => k.startsWith('teacher-'))) { settled = true; resolve(true); }
      });
      ch.subscribe((s) => { if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') { settled = true; resolve(false); } });
      window.setTimeout(() => { if (!settled) { settled = true; resolve(false); } }, 4000);
    });
    if (!found) { await supa.removeChannel(ch); setStatus('not-found'); return false; }
    ch.on('broadcast', { event: 'state' }, ({ payload }) => {
      const snap = payload as Snapshot<P, S>;
      setAccess(snap.access?.[studentId] ?? 'view');
      snapRef.current(snap);
    });
    ch.on('broadcast', { event: 'ended' }, () => setStatus('ended'));
    channelRef.current = ch;
    setStatus('idle');
    return true;
  }, []);

  // Step 2: show up in the teacher's list by name and ask for the board.
  const join = useCallback(async (studentName: string) => {
    const ch = channelRef.current;
    if (!ch) return;
    setName(studentName);
    await ch.track({ role: 'student', name: studentName });
    await ch.send({ type: 'broadcast', event: 'hello', payload: {} });
    setStatus('joined');
  }, []);

  const sendOps = useCallback((ops: Omit<Ops<P, S>, 'from'>) => {
    void channelRef.current?.send({ type: 'broadcast', event: 'ops', payload: { ...ops, from: studentId } });
  }, []);

  useEffect(() => () => { const ch = channelRef.current; if (ch) void getClient()?.removeChannel(ch); }, []);

  return { status, access, name, checkCode, join, sendOps };
}

// Changes from `before` to `after`, by id. Positions of pieces that are snapped into a row or a Sound Box are
// computed on each screen, so tiny differences there are not sent as edits.
export function diffItems<P extends { instanceId: string; x: number; y: number; snapLeftId?: string; inFrameId?: string }>(before: P[], after: P[]) {
  const prev = new Map(before.map((p) => [p.instanceId, p]));
  const upserts: P[] = [];
  for (const item of after) {
    const old = prev.get(item.instanceId);
    if (!old) { upserts.push(item); continue; }
    const derived = !!item.snapLeftId || !!item.inFrameId;
    const moved = !derived && (Math.abs(old.x - item.x) > 1 || Math.abs(old.y - item.y) > 1);
    const strip = (p: P) => JSON.stringify({ ...p, x: 0, y: 0 });
    if (moved || strip(old) !== strip(item)) upserts.push(item);
  }
  const now = new Set(after.map((p) => p.instanceId));
  const removes = before.filter((p) => !now.has(p.instanceId)).map((p) => p.instanceId);
  return { upserts, removes };
}

export function isJoinRoute(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.replace(/\/+$/, '') === '/join' || new URLSearchParams(window.location.search).has('join');
}
