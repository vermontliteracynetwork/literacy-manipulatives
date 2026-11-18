import './lessons.css';
import '../procedures/procedures.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadEngine } from 'symbolic-grammar-engine';
import LiteracyManipulatives, { type BoardData } from '../../LiteracyManipulatives';
import { HomeButton } from '../HomeButton';
import { ActivityEditor, ActivityView, FormulaPicker, SymbolPicker } from './Activities';
import { Progress } from './Progress';
import { Fit } from './Fit';
import { StudentScreen } from './LessonJoin';
import {
  PRESETS, TAB_COLOR, TAB_KINDS, asLesson, blankLesson, copyTab, newActivity, newCode, newId, newTab, stopsOf, tabKindName,
  type Activity, type Lesson, type Section, type Tab, type TabKind,
} from '../../lib/lessons/types';
import { str, summarize, type Resp } from '../../lib/lessons/check';

const FLAG_NAME: Record<string, string> = { help: 'Needs help', break: 'On a break', done: 'Done' };
import { useLessonHost, type Pos, type Work } from '../../lib/lessons/live';
import { readReports, reportCsv, writeReports, type Session } from '../../lib/lessons/reports';
import { deleteFolder, deleteProcedure, listFolders, listProcedures, saveFolder, saveProcedure } from '../../lib/procedures/library';
import { shareConfigured } from '../../lib/share';
import type { Folder, Procedure } from '../../lib/procedures/types';

// Daily Lesson (her request 2026-11-18): the Daily Procedure rebuilt. Left: the lesson's tabs (Goal, Review,
// Instruction, Practice, Assessment, Application), each opening to its subheaders and activities (several tabs can be
// open at once; any tab can be duplicated). Right: the open tab's activities as square cards, or one activity.
// Edit mode changes every detail students see. Present mode shows the lesson full screen; students join with the
// lesson's own code on the join page, follow the teacher, and do the activities the teacher opened for them, while
// the teacher sees each student's work live. Every share is kept as a report of each student's work.

type Mode = 'edit' | 'present';
const OPEN_KEY = 'lm-lesson-open';
const readOpen = (): Lesson | null => { try { const x = JSON.parse(sessionStorage.getItem(OPEN_KEY) ?? 'null'); return x ? asLesson(x) : null; } catch { return null; } };
const writeOpen = (l: Lesson) => { try { sessionStorage.setItem(OPEN_KEY, JSON.stringify(l)); } catch { /* too big for this tab */ } };

// A join link with the code in it, to send to a student: they only type their name (her request 2026-11-18).
function CopyLink({ code }: { code: string }) {
  const [done, setDone] = useState(false);
  const link = `${window.location.origin}/lesson?code=${code}`;
  return <button type="button" className="btn btn-sm" title={link} onClick={() => { void navigator.clipboard?.writeText(link).then(() => { setDone(true); window.setTimeout(() => setDone(false), 1500); }); }}>{done ? 'Copied' : 'Copy join link'}</button>;
}


// A side menu that can be dragged wider or narrower by its inner edge and folded away (her request 2026-11-18:
// "allow all menus (right bar and left column menu) to be resizeable and collapsable"). Remembered on this computer.
function SidePane({ id, side, width, label, children }: { id: string; side: 'left' | 'right'; width: number; label: string; children: React.ReactNode }) {
  const key = `lm-lesson-pane-${id}`;
  const [w, setW] = useState<number>(() => { try { return Number(localStorage.getItem(`${key}-w`)) || width; } catch { return width; } });
  const [shut, setShut] = useState<boolean>(() => { try { return localStorage.getItem(`${key}-shut`) === '1'; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem(`${key}-w`, String(Math.round(w))); localStorage.setItem(`${key}-shut`, shut ? '1' : '0'); } catch { /* not kept */ } }, [w, shut]);
  const drag = (e: React.PointerEvent) => {
    e.preventDefault();
    const x0 = e.clientX, w0 = w;
    const move = (ev: PointerEvent) => setW(Math.max(200, Math.min(640, w0 + (side === 'left' ? ev.clientX - x0 : x0 - ev.clientX))));
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  if (shut) return <div className={`ln-pane-rail ln-pane-${side}`}><button type="button" className="ln-pane-open" onClick={() => setShut(false)} aria-label={`Open ${label}`} title={`Open ${label}`}>{side === 'left' ? '»' : '«'}</button></div>;
  return (
    <aside className={`ln-pane ln-pane-${side}`} style={{ width: w }} aria-label={label}>
      <button type="button" className="ln-pane-close" onClick={() => setShut(true)} aria-label={`Fold away ${label}`} title={`Fold away ${label}`}>{side === 'left' ? '«' : '»'}</button>
      <div className="ln-pane-body">{children}</div>
      <div className="ln-pane-grip" role="separator" aria-orientation="vertical" aria-label={`Resize ${label}`} onPointerDown={drag} />
    </aside>
  );
}

// A name that is renamed in place: double-click it, type, and press Enter (Escape keeps the old name).
const KIND_ORDER: TabKind[] = ['goal', 'review', 'instruction', 'practice', 'application', 'assessment'];

function EditableText({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(value);
  if (!edit) return <span className="ln-editable" title="Double-click to rename" onDoubleClick={(e) => { e.stopPropagation(); setV(value); setEdit(true); }}>{value}</span>;
  const done = (save: boolean) => { setEdit(false); if (save && v.trim() && v.trim() !== value) onSave(v.trim()); };
  return <input className="ln-rename" autoFocus value={v} aria-label="New name" onClick={(e) => e.stopPropagation()} onChange={(e) => setV(e.target.value)} onBlur={() => done(true)}
    onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); }} />;
}

// The daily plan: one row for each part of the lesson, with every activity that fits it as a card that scrolls sideways
// (her request 2026-11-18: "look more like the menus on netflix with side scroll"). Picking a card adds it to that part,
// and it shows in the lesson plan on the left; a picked card opens it, and its x takes it out again.
function DailyPlanView({ lesson, onAdd, onOpen, onRemove, onAddTab, onCatalog }: {
  lesson: Lesson; onAdd: (tabId: string, preset: string) => void; onOpen: (activityId: string) => void; onRemove: (activityId: string) => void; onAddTab: (k: TabKind) => void; onCatalog: (tabId: string) => void;
}) {
  return (
    <main className="ln-main ln-dp">
      <div className="ln-dp-head">
        <h1 className="ln-dp-title">Daily plan</h1>
        <p className="ln-muted">Pick the activities for each part of today's lesson. They show in the lesson plan on the left, in order.</p>
      </div>
      {!lesson.tabs.some((t) => t.kind === 'goal') && (
        <div className="ln-dp-start"><button type="button" className="btn btn-sm" onClick={() => onAddTab('goal')}>Add a "Today's plan" slide at the start</button></div>
      )}
      {lesson.tabs.map((t) => {
        const picked = t.sections.flatMap((x) => x.activities);
        const presets = PRESETS.filter((p) => p.tabs.includes(t.kind) && p.id !== 'whiteboard').sort((x, y) => Number(x.id === 'slide') - Number(y.id === 'slide'));
        const extra = picked.filter((x) => !presets.some((p) => p.id === x.preset));
        return (
          <section key={t.id} className="ln-dp-row" aria-label={t.title}>
            <h2 className="ln-dp-row-h"><span className="ln-plan-dot" style={{ background: TAB_COLOR[t.kind] }} />{t.title}<span className="ln-plan-n">{picked.length} picked</span></h2>
            <div className="ln-dp-scroll">
              {[...extra.map((x) => ({ id: x.preset, name: x.title, about: x.about, act: x })), ...presets.map((p) => ({ id: p.id, name: p.name, about: p.about, act: picked.find((x) => x.preset === p.id) }))].map((c, i) => (
                <div key={`${c.id}-${i}`} className={`ln-dp-card${c.act ? ' picked' : ''}`} style={{ ['--tab' as string]: TAB_COLOR[t.kind] }}>
                  <button type="button" className="ln-dp-card-btn" onClick={() => (c.act ? onOpen(c.act.id) : onAdd(t.id, c.id))} aria-label={c.act ? `Open ${c.name}` : `Add ${c.name} to ${t.title}`}>
                    <span className="ln-dp-card-name">{c.name}</span>
                    <span className="ln-dp-card-about">{c.about}</span>
                    <span className="ln-dp-card-foot">{c.act ? 'In the plan ✓' : '+ Add'}</span>
                  </button>
                  {c.act && <button type="button" className="ln-dp-x" aria-label={`Take ${c.name} out of the plan`} title="Take it out of the plan" onClick={() => onRemove(c.act!.id)}>×</button>}
                </div>
              ))}
              <button type="button" className="ln-dp-card ln-dp-more" onClick={() => onCatalog(t.id)}><span className="ln-dp-card-name">More activities</span><span className="ln-dp-card-about">Search every activity</span></button>
            </div>
          </section>
        );
      })}
    </main>
  );
}

function Modal({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return (
    <div className="dp-modal-back" onClick={onClose}>
      <div className={`dp-modal${wide ? ' ln-modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="dp-modal-head"><h2>{title}</h2><button type="button" className="btn btn-sm" onClick={onClose}>Close</button></div>
        {children}
      </div>
    </div>
  );
}

export function DailyLesson() {
  const [lesson, setLesson] = useState<Lesson>(() => readOpen() ?? blankLesson());
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState<Mode>('edit');
  const [tabId, setTabId] = useState(lesson.tabs[0]?.id ?? '');
  const [actId, setActId] = useState<string | null>(null);
  // The daily plan (her request 2026-11-18): the lesson plan's main screen, a row of activity cards for each part.
  const [planView, setPlanView] = useState(true);
  const [open, setOpen] = useState<Set<string>>(() => new Set(lesson.tabs.slice(0, 2).map((t) => t.id)));
  const [dialog, setDialog] = useState<null | 'library' | 'save' | 'settings' | 'reports' | { catalog: string }>(null);
  const [msg, setMsg] = useState('');
  const [, setReady] = useState(0);
  useEffect(() => { document.title = 'Daily Lesson'; void loadEngine().then(() => setReady((n) => n + 1)).catch(() => undefined); }, []);
  useEffect(() => { const t = window.setTimeout(() => writeOpen(lesson), 400); return () => window.clearTimeout(t); }, [lesson]);
  // Once a lesson is saved and named, every change saves itself (her request 2026-11-18: "auto save updates").
  useEffect(() => {
    if (!lesson.saved || !dirty) return;
    const t = window.setTimeout(() => { void saveProcedure({ ...lesson, updatedAt: new Date().toISOString() } as unknown as Procedure).then(() => setDirty(false)); }, 1200);
    return () => window.clearTimeout(t);
  }, [lesson, dirty]);

  const change = useCallback((fn: (l: Lesson) => Lesson) => { setLesson((l) => fn(l)); setDirty(true); }, []);
  const tab = lesson.tabs.find((t) => t.id === tabId) ?? lesson.tabs[0];
  const where = (id: string | null) => { for (const t of lesson.tabs) for (const s of t.sections) { const a = s.activities.find((x) => x.id === id); if (a) return { t, s, a }; } return null; };
  const sel = where(actId);

  const mapTabs = (fn: (t: Tab) => Tab) => change((l) => ({ ...l, tabs: l.tabs.map(fn) }));
  const updateTab = (id: string, patch: Partial<Tab>) => mapTabs((t) => (t.id === id ? { ...t, ...patch } : t));
  const updateSection = (tid: string, sid: string, patch: Partial<Section>) => mapTabs((t) => (t.id === tid ? { ...t, sections: t.sections.map((s) => (s.id === sid ? { ...s, ...patch } : s)) } : t));
  const updateActivity = (id: string, patch: Partial<Activity>) => mapTabs((t) => ({ ...t, sections: t.sections.map((s) => ({ ...s, activities: s.activities.map((a) => (a.id === id ? { ...a, ...patch } : a)) })) }));
  const toggle = (id: string) => setOpen((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // A new part goes in its place in the default order (her rule 2026-11-18: "review, instruction, practice, assessment
  // should always be the default order"): after the last part of the same kind or of a kind that comes before it.
  const addTab = (kind: TabKind) => {
    const t = newTab(kind, lesson.focus);
    const rank = (k: TabKind) => KIND_ORDER.indexOf(k);
    change((l) => { const tabs = [...l.tabs]; let at = 0; tabs.forEach((x, i) => { if (rank(x.kind) <= rank(kind)) at = i + 1; }); tabs.splice(at, 0, t); return { ...l, tabs }; });
    setOpen((o) => new Set(o).add(t.id));
  };
  // A card picked in the daily plan goes into that part of the lesson (its last subheader).
  const addFromPlan = (tid: string, preset: string) => {
    const a = newActivity(preset, lesson.focus);
    change((l) => ({ ...l, tabs: l.tabs.map((t) => {
      if (t.id !== tid) return t;
      const sections = t.sections.length ? t.sections : [{ id: newId(), title: t.title, activities: [] }];
      return { ...t, sections: sections.map((x, i) => (i === sections.length - 1 ? { ...x, activities: [...x.activities, a] } : x)) };
    }) }));
    setOpen((o) => new Set(o).add(tid));
  };
  const dupTab = (t: Tab) => { const c = copyTab(t); change((l) => { const tabs = [...l.tabs]; tabs.splice(tabs.findIndex((x) => x.id === t.id) + 1, 0, c); return { ...l, tabs }; }); setTabId(c.id); setActId(null); setOpen((o) => new Set(o).add(c.id)); };
  const delTab = (t: Tab) => { if (lesson.tabs.length <= 1 || !window.confirm(`Delete the tab "${t.title}" and its activities?`)) return; change((l) => ({ ...l, tabs: l.tabs.filter((x) => x.id !== t.id) })); setTabId(lesson.tabs.find((x) => x.id !== t.id)!.id); setActId(null); };
  const reorderTab = (from: number, to: number) => change((l) => { if (from === to) return l; const tabs = [...l.tabs]; const [m] = tabs.splice(from, 1); tabs.splice(to, 0, m); return { ...l, tabs }; });
  // Drag an activity in the menu: before another activity, or to the end of a subheader (any tab).
  const moveActivityTo = (id: string, sectionId: string, beforeId: string | null) => change((l) => {
    let moving: Activity | undefined;
    const tabs = l.tabs.map((t) => ({ ...t, sections: t.sections.map((x) => { const a = x.activities.find((y) => y.id === id); if (a) moving = a; return a ? { ...x, activities: x.activities.filter((y) => y.id !== id) } : x; }) }));
    if (!moving) return l;
    return { ...l, tabs: tabs.map((t) => ({ ...t, sections: t.sections.map((x) => {
      if (x.id !== sectionId) return x;
      const acts = [...x.activities];
      const at = beforeId ? acts.findIndex((y) => y.id === beforeId) : -1;
      acts.splice(at < 0 ? acts.length : at, 0, moving!);
      return { ...x, activities: acts };
    }) })) };
  });
  const addSection = (t: Tab) => updateTab(t.id, { sections: [...t.sections, { id: newId(), title: 'New subheader', activities: [] }] });
  const delSection = (t: Tab, s: Section) => { if (s.activities.length && !window.confirm(`Delete "${s.title}" and its ${s.activities.length} activities?`)) return; updateTab(t.id, { sections: t.sections.filter((x) => x.id !== s.id) }); };
  const addActivity = (sid: string, preset: string) => { const a = newActivity(preset, lesson.focus); mapTabs((t) => ({ ...t, sections: t.sections.map((s) => (s.id === sid ? { ...s, activities: [...s.activities, a] } : s)) })); setActId(a.id); setDialog(null); };
  const dupActivity = (a: Activity) => { const c = { ...structuredClone(a), id: newId(), title: `${a.title} (copy)` }; mapTabs((t) => ({ ...t, sections: t.sections.map((s) => { const i = s.activities.findIndex((x) => x.id === a.id); if (i < 0) return s; const acts = [...s.activities]; acts.splice(i + 1, 0, c); return { ...s, activities: acts }; }) })); setActId(c.id); };
  const delActivity = (a: Activity) => { if (!window.confirm(`Delete "${a.title}"?`)) return; mapTabs((t) => ({ ...t, sections: t.sections.map((s) => ({ ...s, activities: s.activities.filter((x) => x.id !== a.id) })) })); setActId(null); };
  const moveActivity = (a: Activity, d: -1 | 1) => mapTabs((t) => ({ ...t, sections: t.sections.map((s) => { const i = s.activities.findIndex((x) => x.id === a.id); const j = i + d; if (i < 0 || j < 0 || j >= s.activities.length) return s; const acts = [...s.activities]; [acts[i], acts[j]] = [acts[j], acts[i]]; return { ...s, activities: acts }; }) }));

  const flash = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(''), 2200); };
  const save = async (l: Lesson = lesson) => {
    const next = { ...l, code: l.code ?? newCode(), saved: true, updatedAt: new Date().toISOString() };
    await saveProcedure(next as unknown as Procedure);
    setLesson(next); setDirty(false); flash('Saved');
  };
  const openLesson = (l: Lesson) => { setLesson(l); setTabId(l.tabs[0]?.id ?? ''); setActId(null); setOpen(new Set(l.tabs.slice(0, 2).map((t) => t.id))); setDirty(false); setDialog(null); };

  // ---------- Present mode ----------
  const stops = useMemo(() => stopsOf(lesson), [lesson]);
  const [at, setAt] = useState(0);
  const [teacherResp, setTeacherResp] = useState<Record<string, Resp>>({});
  const [done, setDone] = useState<string[]>([]);
  const [live, setLive] = useState<Record<string, Record<string, Work>>>({}); // activity → student → latest work
  const [notesOpen, setNotesOpen] = useState(true);
  const [showBar, setShowBar] = useState(true);
  // Preview as student (her request 2026-11-18): the student screen, right here, without joining as a pretend student.
  const [preview, setPreview] = useState<number | null>(null);
  const [spTall, setSpTall] = useState(false);
  const [spWork, setSpWork] = useState<Record<string, Resp>>({});
  const [spFlag, setSpFlag] = useState('');
  // The iPad frame shrinks to fit this window, so the preview never needs a scroll bar either.
  const [spScale, setSpScale] = useState(1);
  useEffect(() => {
    if (preview == null) return;
    const fit = () => setSpScale(Math.min(1, (window.innerWidth - 32) / (spTall ? 796 : 1052), (window.innerHeight - 150) / (spTall ? 1052 : 796)));
    fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit);
  }, [preview, spTall]);
  const [zoom, setZoom] = useState<Work | null>(null);
  const session = useRef<Session | null>(null);
  const stop = stops[Math.min(at, stops.length - 1)];
  const pos: Pos = { at: mode === 'present' ? stop?.activity.id ?? null : null, tabId: stop?.tab.id ?? null, teacherResp: stop ? teacherResp[stop.activity.id] ?? {} : {}, done, progress: lesson.progress };
  const onWork = useCallback((w: Work) => {
    setLive((m) => ({ ...m, [w.activityId]: { ...m[w.activityId], [w.from]: w } }));
    if (w.activityId === '__flag') return;
    const s = session.current;
    if (!s) return;
    const st = s.students[w.from] ?? { name: w.name, work: {} };
    s.students[w.from] = { name: w.name || st.name, work: { ...st.work, [w.activityId]: { resp: w.resp, at: new Date().toISOString() } } };
    const list = readReports(lesson.id).filter((x) => x.id !== s.id);
    writeReports(lesson.id, [...list, s]);
  }, [lesson.id]);
  const onCode = useCallback((code: string) => { change((l) => ({ ...l, code })); }, [change]);
  const host = useLessonHost(lesson, pos, onWork, onCode);
  const startShare = async () => { await host.start(); };
  useEffect(() => { if (host.status === 'live' && host.code && !session.current) session.current = { id: newId(), startedAt: new Date().toISOString(), code: host.code, students: {} }; if (host.status === 'off') session.current = null; }, [host.status, host.code]);
  const go = (i: number) => { const j = Math.max(0, Math.min(stops.length - 1, i)); if (stop && j > at) setDone((d) => (d.includes(stop.activity.id) ? d : [...d, stop.activity.id])); setAt(j); };
  const present = (fromActivity?: string | null) => { const i = fromActivity ? stops.findIndex((s) => s.activity.id === fromActivity) : stops.findIndex((s) => s.tab.id === tab?.id); setAt(Math.max(0, i)); setMode('present'); };
  useEffect(() => {
    if (mode !== 'present') return;
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable="true"], .lm-page')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(at + 1); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(at - 1); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  const onBoard = useCallback((b: BoardData) => { if (actId) updateActivity(actId, { board: b }); }, [actId]);
  const boardEmbed = useMemo(() => (sel?.a.engine === 'board' ? { initial: sel.a.board ?? { placed: [], strokes: [] }, onChange: onBoard, presenting: false } : null), [sel?.a.id]);

  if (mode === 'present' && stop) {
    const a = stop.activity;
    const work = Object.values(live[a.id] ?? {});
    const joinUrl = `${window.location.origin}/join`;
    return (
      <div className="ln ln-present">
        <header className="ln-bar">
          <button type="button" className="btn btn-sm" onClick={() => setMode('edit')}>Back to Edit</button>
          <span className="ln-title">{lesson.title}</span>
          <span style={{ flex: 1 }} />
          <div className="dp-row" role="radiogroup" aria-label="What students see across the top">
            <button type="button" role="radio" aria-checked={lesson.progress === 'bar'} className={`btn btn-sm${lesson.progress === 'bar' ? ' btn-primary' : ''}`} onClick={() => change((l) => ({ ...l, progress: 'bar' }))}>Progress bar</button>
            <button type="button" role="radio" aria-checked={lesson.progress === 'checklist'} className={`btn btn-sm${lesson.progress === 'checklist' ? ' btn-primary' : ''}`} onClick={() => change((l) => ({ ...l, progress: 'checklist' }))}>Checklist</button>
          </div>
          {host.status === 'live'
            ? <span className="ln-live" title={`Students go to ${joinUrl} and type this code`}>Join code <strong>{host.code}</strong> · {host.students.length} joined <CopyLink code={host.code ?? ''} /> <button type="button" className="btn btn-sm" onClick={() => void host.stop()}>Stop sharing</button></span>
            : !lesson.saved || !lesson.code
              ? <button type="button" className="btn btn-sm btn-primary" title="A lesson gets its join code when you save and name it" onClick={() => { setMode('edit'); setDialog('save'); }}>Save and name the lesson to share</button>
              : <button type="button" className="btn btn-sm btn-primary" disabled={!shareConfigured || host.status === 'starting'} title={shareConfigured ? `Students join at ${joinUrl}` : "Sharing isn't set up on this site yet"} onClick={() => void startShare()}>{host.status === 'starting' ? 'Starting...' : `Share with students (code ${lesson.code})`}</button>}
          <button type="button" className={`btn btn-sm${notesOpen ? ' btn-primary' : ''}`} aria-pressed={notesOpen} onClick={() => setNotesOpen((x) => !x)}>Notes and students</button>
          <button type="button" className="btn btn-sm" onClick={() => { void document.documentElement.requestFullscreen?.().catch(() => undefined); }}>Full screen</button>
        </header>
        {host.error && <p className="ln-error" role="alert">{host.error}</p>}
        <div className="ln-present-body">
          <div className="ln-stage-wrap">
            {showBar ? <Progress lesson={lesson} at={a.id} done={done} view={lesson.progress} onPick={(id) => go(stops.findIndex((s) => s.activity.id === id))} /> : null}
            <button type="button" className="ln-bar-fold" onClick={() => setShowBar((x) => !x)} aria-expanded={showBar}>{showBar ? 'Hide the plan bar on my screen' : 'Show the plan bar'}</button>
            <main className="ln-stage ln-stage-fit" aria-label={a.title}>
              {a.engine === 'board'
                ? <ActivityView key={a.id} a={a} lesson={lesson} resp={{}} set={() => {}} interactive teacher />
                : (
                  <Fit slide>
                    <h1 className="ln-stage-title"><span className="ln-stage-tab">{stop.tab.title}</span> {a.title}</h1>
                    <ActivityView key={a.id} a={a} lesson={lesson} quiet={stop.tab.kind === 'assessment'} resp={teacherResp[a.id] ?? {}} set={(r) => setTeacherResp((m) => ({ ...m, [a.id]: r }))} interactive teacher />
                  </Fit>
                )}
            </main>
            <footer className="ln-foot">
              <button type="button" className="btn ln-big" disabled={at === 0} onClick={() => go(at - 1)}>Back</button>
              <span className="ln-muted">{at + 1} of {stops.length}</span>
              <button type="button" className="btn btn-primary ln-big" disabled={at >= stops.length - 1} onClick={() => go(at + 1)}>Next</button>
            </footer>
          </div>
          {notesOpen && (
            <SidePane id="teacher" side="right" width={340} label="Notes and students">
              <div className="ln-teacher">
              <h2 className="ln-side-h">Only you see this</h2>
              <label className="dp-check ln-side-check"><input type="checkbox" checked={a.access === 'do'} onChange={(e) => updateActivity(a.id, { access: e.target.checked ? 'do' : 'view' })} /> Students work on this on their iPads</label>
              {(stop.tab.notes || a.notes) ? <div className="ln-notes">{stop.tab.notes && <p>{stop.tab.notes}</p>}{a.notes && <p>{a.notes}</p>}</div> : <p className="dp-muted">No notes for this activity.</p>}
              <h2 className="ln-side-h">Students {host.status === 'live' ? `(${host.students.length})` : ''}</h2>
              {host.status !== 'live' ? <p className="dp-muted">Share with students to see their work live. They join on the join page with the lesson's code.</p>
                : host.students.length === 0 ? <p className="dp-muted">Waiting for students. They go to {joinUrl} and type {host.code}, or open the join link: {window.location.origin}/lesson?code={host.code}</p>
                : a.access !== 'do' ? (
                  <div className="ln-work-grid">
                    <p className="dp-muted">Students are watching. Check "Students work on this" above to let them do it.</p>
                    {host.students.map((st) => { const flag = str(live.__flag?.[st.id]?.resp.flag); return <p key={st.id} className="ln-work-name">{st.name}{flag && <span className={`ln-flag ln-flag-${flag}`}>{FLAG_NAME[flag] ?? flag}</span>}</p>; })}
                  </div>
                )
                : (
                  <div className="ln-work-grid">
                    {host.students.map((st) => {
                      const w = work.find((x) => x.from === st.id);
                      const flag = str(live.__flag?.[st.id]?.resp.flag);
                      const sum = w ? summarize(a, w.resp) : null;
                      return (
                        <button key={st.id} type="button" className="ln-work" onClick={() => w && setZoom(w)} disabled={!w}>
                          <span className="ln-work-name">{st.name}{flag && <span className={`ln-flag ln-flag-${flag}`}>{FLAG_NAME[flag] ?? flag}</span>}{sum?.total ? <span className="ln-work-score">{sum.right} of {sum.total}</span> : null}</span>
                          <span className="ln-work-text">{sum?.text || 'Not started'}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
            </div>
            </SidePane>
          )}
        </div>
        {zoom && (
          <Modal title={`${zoom.name}: ${a.title}`} onClose={() => setZoom(null)} wide>
            <div className="ln-zoom"><ActivityView a={a} lesson={lesson} quiet={stop.tab.kind === 'assessment'} resp={zoom.resp} set={() => {}} interactive={false} teacher /></div>
          </Modal>
        )}
      </div>
    );
  }

  // ---------- Edit mode ----------
  return (
    <div className="ln ln-edit">
      <header className="ln-bar">
        <HomeButton />
        <span className="ln-app">Daily Lesson</span>
        <input className="dp-doc-title-input" value={lesson.title} onChange={(e) => change((l) => ({ ...l, title: e.target.value }))} aria-label="Lesson name" />
        <button type="button" className="btn btn-sm btn-primary" onClick={() => present(actId)}>Present</button>
        <button type="button" className="btn btn-sm" onClick={() => setPreview(Math.max(0, actId ? stops.findIndex((x) => x.activity.id === actId) : stops.findIndex((x) => x.tab.id === tab?.id)))}>Preview as student</button>
        <span style={{ flex: 1 }} />
        <span className="dp-save-state" role="status">{msg || (lesson.saved ? (dirty ? 'Saving...' : 'All changes saved') : 'Not saved yet')}</span>
        {lesson.saved && lesson.code && <><span className="ln-code-chip" title="Students type this code on the join page when you present and share">Join code {lesson.code}</span><CopyLink code={lesson.code} /></>}
        {!lesson.saved && <button type="button" className="btn btn-sm btn-primary" onClick={() => setDialog('save')}>Save</button>}
        <button type="button" className="btn btn-sm" onClick={() => setDialog('save')}>Save as</button>
        <button type="button" className="btn btn-sm" onClick={() => setDialog('library')}>Open</button>
        <button type="button" className="btn btn-sm" onClick={() => setDialog('reports')}>Reports</button>
        <button type="button" className="btn btn-sm" onClick={() => setDialog('settings')}>Lesson settings</button>
      </header>
      <div className="ln-body">
        <SidePane id="nav" side="left" width={270} label="Lesson menu">
          <div className="ln-nav">
            <section className="lm-category ln-plan-box" aria-label="Lesson plan">
              <div className="lm-category-header ln-cat-head" style={{ background: '#FBF2BB' }}>
                <button type="button" className={`ln-cat-btn${planView && !actId ? ' on' : ''}`} onClick={() => { setPlanView(true); setActId(null); }} title="Open the daily plan">
                  <span>Lesson plan</span>
                </button>
                <select className="ln-plus-select" value="" aria-label="Add a part of the lesson" title="Add a part of the lesson" onChange={(e) => { if (e.target.value) addTab(e.target.value as TabKind); }}>
                  <option value="">+</option>
                  {TAB_KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.name}</option>)}
                </select>
              </div>
              <ol className="ln-plan-list">
                {lesson.tabs.map((t, ti) => {
                  const isOpen = open.has(t.id);
                  const count = t.sections.reduce((n, x) => n + x.activities.length, 0);
                  return (
                    <li key={t.id} className="ln-plan-row">
                      <div className="ln-plan-head" draggable onDragStart={(e) => { e.dataTransfer.setData('text/ln-tab', String(ti)); e.dataTransfer.effectAllowed = 'move'; }}
                        onDragOver={(e) => { if (e.dataTransfer.types.includes('text/ln-tab')) { e.preventDefault(); e.currentTarget.classList.add('drop'); } }}
                        onDragLeave={(e) => e.currentTarget.classList.remove('drop')}
                        onDrop={(e) => { e.currentTarget.classList.remove('drop'); const from = Number(e.dataTransfer.getData('text/ln-tab')); if (!Number.isNaN(from)) reorderTab(from, ti); }}>
                        <span className="ln-grip" aria-hidden>⋮⋮</span>
                        <button type="button" className="ln-caret-btn" aria-expanded={isOpen} aria-label={isOpen ? `Close ${t.title}` : `Open ${t.title}`} onClick={() => toggle(t.id)}>{isOpen ? '▾' : '▸'}</button>
                        <span className="ln-plan-dot" style={{ background: TAB_COLOR[t.kind] }} />
                        <span className={`ln-plan-item${!planView && !actId && t.id === tab?.id ? ' on' : ''}`} role="button" tabIndex={0}
                          onClick={() => { setTabId(t.id); setActId(null); setPlanView(false); setOpen((o) => new Set(o).add(t.id)); }}
                          onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) { setTabId(t.id); setActId(null); setPlanView(false); } }}>
                          <EditableText value={t.title} onSave={(v) => updateTab(t.id, { title: v })} />
                        </span>
                        <span className="ln-plan-n">{count}</span>
                      </div>
                      {isOpen && (
                        <div className="ln-plan-sub">
                          {count === 0 && <p className="ln-plan-empty">Nothing yet. Add activities in the daily plan.</p>}
                          {t.sections.map((sec) => (
                            <div key={sec.id} className="ln-sec">
                              {t.sections.length > 1 && <p className="ln-sec-title"><EditableText value={sec.title} onSave={(v) => updateSection(t.id, sec.id, { title: v })} /></p>}
                              <ul onDragOver={(e) => { if (e.dataTransfer.types.includes('text/ln-act')) e.preventDefault(); }} onDrop={(e) => { const id = e.dataTransfer.getData('text/ln-act'); if (id) moveActivityTo(id, sec.id, null); }}>
                                {sec.activities.map((x) => (
                                  <li key={x.id} draggable onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData('text/ln-act', x.id); e.dataTransfer.effectAllowed = 'move'; }}
                                    onDragOver={(e) => { if (e.dataTransfer.types.includes('text/ln-act')) { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add('drop'); } }}
                                    onDragLeave={(e) => e.currentTarget.classList.remove('drop')}
                                    onDrop={(e) => { e.stopPropagation(); e.currentTarget.classList.remove('drop'); const id = e.dataTransfer.getData('text/ln-act'); if (id && id !== x.id) moveActivityTo(id, sec.id, x.id); }}>
                                    <span role="button" tabIndex={0} className={`ln-item${x.id === actId ? ' on' : ''}`} onClick={() => { setTabId(t.id); setActId(x.id); setPlanView(false); }} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) { setTabId(t.id); setActId(x.id); } }}>
                                      <EditableText value={x.title} onSave={(v) => updateActivity(x.id, { title: v })} />
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
              <p className="ln-plan-tip">Double-click a name to rename it. Drag to reorder.</p>
            </section>
          </div>
        </SidePane>

        {sel ? (
          <>
            <main className="ln-main ln-main-fit">
              <div className="ln-crumbs">
                <button type="button" className="btn btn-sm" onClick={() => setActId(null)}>← {sel.t.title}</button>
                <span className="ln-muted">{sel.s.title}</span>
                <span style={{ flex: 1 }} />
                <button type="button" className="btn btn-sm" onClick={() => moveActivity(sel.a, -1)} aria-label="Move earlier">Earlier</button>
                <button type="button" className="btn btn-sm" onClick={() => moveActivity(sel.a, 1)} aria-label="Move later">Later</button>
                <button type="button" className="btn btn-sm" onClick={() => dupActivity(sel.a)}>Duplicate</button>
                <button type="button" className="btn btn-sm" onClick={() => delActivity(sel.a)}>Delete</button>
                <button type="button" className="btn btn-sm btn-primary" onClick={() => present(sel.a.id)}>Present from here</button>
              </div>
              <p className="ln-preview-label">What students see when you present</p>
              {sel.a.engine === 'board' && boardEmbed
                ? <div className="ln-board ln-board-fill"><LiteracyManipulatives key={sel.a.id} embed={boardEmbed} /></div>
                : (
                  <Fit slide className="ln-preview-fit">
                    <h1 className="ln-stage-title"><span className="ln-stage-tab">{sel.t.title}</span> {sel.a.title}</h1>
                    <ActivityView key={sel.a.id + JSON.stringify(sel.a.data).length} a={sel.a} lesson={lesson} quiet={sel.t.kind === 'assessment'} resp={teacherResp[sel.a.id] ?? {}} set={(r) => setTeacherResp((m) => ({ ...m, [sel.a.id]: r }))} interactive teacher />
                  </Fit>
                )}
            </main>
            <SidePane id="panel" side="right" width={360} label="Edit this activity">
              <div className="ln-panel">
                <h2 className="dp-panel-h">Edit this activity</h2>
                <ActivityEditor a={sel.a} lesson={lesson} tabKind={sel.t.kind} onChange={(patch) => updateActivity(sel.a.id, patch)} />
              </div>
            </SidePane>
          </>
        ) : planView ? (
          <DailyPlanView lesson={lesson} onAdd={addFromPlan} onOpen={(id) => { setActId(id); setPlanView(false); }} onRemove={(id) => mapTabs((t) => ({ ...t, sections: t.sections.map((x) => ({ ...x, activities: x.activities.filter((y) => y.id !== id) })) }))}
            onAddTab={addTab} onCatalog={(tid) => { const t = lesson.tabs.find((x) => x.id === tid); if (!t) return; setTabId(tid); const last = t.sections[t.sections.length - 1]; if (last) setDialog({ catalog: last.id }); else { const sec = { id: newId(), title: t.title, activities: [] }; updateTab(tid, { sections: [sec] }); setDialog({ catalog: sec.id }); } }} />
        ) : tab ? (
          <main className="ln-main ln-cards-page">
            <div className="ln-tab-edit">
              <label className="dp-field"><span>Tab name</span><input value={tab.title} onChange={(e) => updateTab(tab.id, { title: e.target.value })} /></label>
              <label className="dp-field"><span>Kind</span>
                <select value={tab.kind} onChange={(e) => updateTab(tab.id, { kind: e.target.value as TabKind })}>{TAB_KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.name}</option>)}</select>
              </label>
              <label className="dp-field"><span>Time</span><input value={tab.minutes ?? ''} placeholder="2 to 4 min" onChange={(e) => updateTab(tab.id, { minutes: e.target.value })} /></label>
              <button type="button" className="btn btn-sm btn-primary" onClick={() => present()}>Present this tab</button>
              <button type="button" className="btn btn-sm" onClick={() => dupTab(tab)}>Duplicate tab</button>
              <button type="button" className="btn btn-sm" onClick={() => delTab(tab)} disabled={lesson.tabs.length <= 1}>Delete tab</button>
            </div>
            <p className="ln-muted">{TAB_KINDS.find((k) => k.kind === tab.kind)?.about}</p>
            {tab.sections.map((s) => (
              <section key={s.id} className="ln-section">
                <div className="ln-section-head">
                  <input className="ln-section-title" value={s.title} onChange={(e) => updateSection(tab.id, s.id, { title: e.target.value })} aria-label="Subheader" />
                  <button type="button" className="btn btn-sm" onClick={() => delSection(tab, s)}>Delete subheader</button>
                </div>
                <div className="ln-cards">
                  {s.activities.map((a) => (
                    <button key={a.id} type="button" className="ln-acard" onClick={() => setActId(a.id)}>
                      <span className="ln-acard-name">{a.title}</span>
                      <span className="ln-acard-about">{a.about}</span>
                      <span className="ln-acard-foot">{[a.minutes, a.scope ? (a.scope === 'lesson' ? 'Lesson-specific' : 'Cumulative review') : ''].filter(Boolean).join(' · ')}</span>
                    </button>
                  ))}
                  <button type="button" className="ln-acard ln-acard-add" onClick={() => setDialog({ catalog: s.id })}><span className="ln-acard-plus">+</span><span>Add an activity</span></button>
                </div>
              </section>
            ))}
            <button type="button" className="btn" onClick={() => addSection(tab)}>Add a subheader</button>
            <label className="dp-field ln-tab-notes"><span>Tab notes <span className="dp-muted">(only you see these)</span></span><textarea rows={4} value={tab.notes} onChange={(e) => updateTab(tab.id, { notes: e.target.value })} /></label>
          </main>
        ) : null}
      </div>

      {dialog && typeof dialog === 'object' && <Catalog kind={tab?.kind ?? 'practice'} onPick={(p) => addActivity(dialog.catalog, p)} onClose={() => setDialog(null)} />}
      {dialog === 'settings' && (
        <Modal title="Lesson settings" onClose={() => setDialog(null)}>
          <label className="dp-field"><span>Lesson name</span><input value={lesson.title} onChange={(e) => change((l) => ({ ...l, title: e.target.value }))} /></label>
          <label className="dp-field"><span>Subtitle</span><input value={lesson.subtitle ?? ''} placeholder="Level B, Unit 1, Lessons 1.1.1 to 1.1.4" onChange={(e) => change((l) => ({ ...l, subtitle: e.target.value }))} /></label>
          <div className="dp-field"><span>Today's symbols <span className="dp-muted">(new activities start with these)</span></span><SymbolPicker value={lesson.focus.symbols} onChange={(symbols) => change((l) => ({ ...l, focus: { ...l.focus, symbols } }))} /></div>
          <div className="dp-field"><span>Today's formulas</span><FormulaPicker value={lesson.focus.formulas} onChange={(formulas) => change((l) => ({ ...l, focus: { ...l.focus, formulas } }))} /></div>
          <div className="dp-field"><span>Students see across the top</span>
            <div className="dp-row">
              {(['bar', 'checklist'] as const).map((v) => <button key={v} type="button" className={`btn btn-sm${lesson.progress === v ? ' btn-primary' : ''}`} onClick={() => change((l) => ({ ...l, progress: v }))}>{v === 'bar' ? 'Progress bar' : 'Checklist'}</button>)}
            </div>
          </div>
          <div className="dp-field"><span>Join code</span>
            {lesson.saved && lesson.code
              ? <div className="dp-row"><strong className="ln-code-big">{lesson.code}</strong><CopyLink code={lesson.code} /><button type="button" className="btn btn-sm" onClick={() => change((l) => ({ ...l, code: newCode() }))}>New code</button></div>
              : <p className="dp-muted">The lesson gets its join code when you save and name it.</p>}
            <small className="dp-muted">This lesson keeps its own code. Students type it on the join page ({window.location.origin}/join) when you present and share.</small>
          </div>
        </Modal>
      )}
      {dialog === 'save' && <SaveLesson lesson={lesson} onClose={() => setDialog(null)} onSave={(l) => { void save(l); setDialog(null); }} />}
      {dialog === 'library' && <LessonLibrary current={lesson} dirty={dirty} onOpen={openLesson} onClose={() => setDialog(null)} />}
      {dialog === 'reports' && <Reports lesson={lesson} onClose={() => setDialog(null)} />}
      {preview != null && stops[preview] && (
        <div className="ln-sp-back" role="dialog" aria-modal="true" aria-label="Preview as student">
          <div className="ln-sp-bar">
            <strong>Preview as student</strong>
            <span className="ln-muted">What a student sees on an iPad. Nothing is sent or saved.</span>
            <span style={{ flex: 1 }} />
            <div className="dp-row" role="radiogroup" aria-label="iPad turned">
              <button type="button" role="radio" aria-checked={!spTall} className={`btn btn-sm${!spTall ? ' btn-primary' : ''}`} onClick={() => setSpTall(false)}>Landscape</button>
              <button type="button" role="radio" aria-checked={spTall} className={`btn btn-sm${spTall ? ' btn-primary' : ''}`} onClick={() => setSpTall(true)}>Portrait</button>
            </div>
            <button type="button" className="btn btn-sm" disabled={preview === 0} onClick={() => setPreview(preview - 1)}>Back</button>
            <span className="ln-muted">{preview + 1} of {stops.length}</span>
            <button type="button" className="btn btn-sm btn-primary" disabled={preview >= stops.length - 1} onClick={() => setPreview(preview + 1)}>Next</button>
            <button type="button" className="btn btn-sm" onClick={() => setPreview(null)}>Close preview</button>
          </div>
          <div className={`ln-sp-ipad${spTall ? ' tall' : ''}`} style={{ transform: `scale(${spScale})`, marginBottom: (spTall ? 1052 : 796) * (spScale - 1) }}>
            <StudentScreen lesson={lesson} stop={stops[preview]} done={stops.slice(0, preview).map((x) => x.activity.id)} progress={lesson.progress} name="Student" teacherResp={{}}
              resp={spWork[stops[preview].activity.id] ?? {}} setResp={(r) => setSpWork((m) => ({ ...m, [stops[preview].activity.id]: r }))} flag={spFlag} onFlag={setSpFlag} />
          </div>
        </div>
      )}
    </div>
  );
}

function Catalog({ kind, onPick, onClose }: { kind: TabKind; onPick: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);
  const list = PRESETS.filter((p) => (all || q ? true : p.tabs.includes(kind))).filter((p) => !q || `${p.name} ${p.about} ${p.group}`.toLowerCase().includes(q.toLowerCase()));
  const groups = [...new Set(list.map((p) => p.group))];
  return (
    <Modal title={`Add an activity to ${tabKindName(kind)}`} onClose={onClose} wide>
      <div className="dp-row">
        <input className="ln-search-in" value={q} placeholder="Search activities" onChange={(e) => setQ(e.target.value)} aria-label="Search activities" autoFocus />
        <label className="dp-check"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Show activities for every tab</label>
      </div>
      {groups.map((g) => (
        <section key={g} className="ln-section">
          <h3 className="ln-cat-h">{g}</h3>
          <div className="ln-cards">
            {list.filter((p) => p.group === g).map((p) => (
              <button key={p.id} type="button" className="ln-acard" onClick={() => onPick(p.id)}>
                <span className="ln-acard-name">{p.name}</span>
                <span className="ln-acard-about">{p.about}</span>
                <span className="ln-acard-foot">{p.levels ? `Levels ${p.levels}` : ''}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </Modal>
  );
}

function useLibrary() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const reload = () => Promise.all([listFolders(), listProcedures()]).then(([f, p]) => {
    setFolders(f.sort((a, b) => a.name.localeCompare(b.name)));
    setLessons((p as unknown as (Lesson | Procedure)[]).map(asLesson).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  }).catch(() => undefined);
  useEffect(() => { void reload(); }, []);
  return { folders, lessons, reload };
}

function SaveLesson({ lesson, onClose, onSave }: { lesson: Lesson; onClose: () => void; onSave: (l: Lesson) => void }) {
  const { folders } = useLibrary();
  const [name, setName] = useState(lesson.title);
  const [folderId, setFolderId] = useState(lesson.folderId ?? '');
  const [newFolder, setNewFolder] = useState('');
  const [asCopy, setAsCopy] = useState(!!lesson.saved);
  const go = async () => {
    let fid: string | null = folderId || null;
    if (folderId === '__new') { fid = null; if (newFolder.trim()) { const f = { id: newId(), name: newFolder.trim() }; await saveFolder(f); fid = f.id; } }
    onSave({ ...lesson, id: asCopy ? newId() : lesson.id, code: asCopy ? newCode() : lesson.code ?? newCode(), title: name.trim() || 'Untitled lesson', folderId: fid });
  };
  return (
    <Modal title="Save lesson" onClose={onClose}>
      <label className="dp-field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="dp-field"><span>Folder</span>
        <select value={folderId} onChange={(e) => setFolderId(e.target.value)}>
          <option value="">No folder</option>
          {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          <option value="__new">New folder...</option>
        </select>
      </label>
      {folderId === '__new' && <label className="dp-field"><span>New folder name</span><input value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="Level B, Unit 1" /></label>}
      {lesson.saved && <label className="dp-check"><input type="checkbox" checked={asCopy} onChange={(e) => setAsCopy(e.target.checked)} /> Save as a new lesson (its own join code)</label>}
      <p className="dp-muted">Lessons and their reports are kept in this browser.</p>
      <div className="dp-row"><button type="button" className="btn btn-primary" onClick={() => void go()}>Save</button><button type="button" className="btn" onClick={onClose}>Cancel</button></div>
    </Modal>
  );
}

function LessonLibrary({ current, dirty, onOpen, onClose }: { current: Lesson; dirty: boolean; onOpen: (l: Lesson) => void; onClose: () => void }) {
  const { folders, lessons, reload } = useLibrary();
  const [folder, setFolder] = useState('all');
  const [folderName, setFolderName] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const leave = (l: Lesson) => { if (!dirty || window.confirm('The lesson open now has unsaved changes. Open another one anyway?')) onOpen(l); };
  const shown = lessons.filter((l) => folder === 'all' || (folder === 'none' ? !l.folderId : l.folderId === folder));
  const download = (l: Lesson) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(l)], { type: 'application/json' })); a.download = `${l.title.replace(/[^\w\- ]+/g, '').trim() || 'lesson'}.lesson.json`; a.click(); URL.revokeObjectURL(a.href); };
  return (
    <Modal title="Open a lesson" onClose={onClose} wide>
      <div className="dp-library">
        <nav className="dp-folders" aria-label="Folders">
          {[['all', 'All lessons'], ['none', 'No folder'], ...folders.map((f) => [f.id, f.name])].map(([id, name]) => (
            <button key={id} type="button" className={`dp-folder${folder === id ? ' on' : ''}`} aria-pressed={folder === id} onClick={() => setFolder(id)}>{name}</button>
          ))}
          <div className="dp-row">
            <input className="dp-folder-input" value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="New folder" aria-label="New folder name" />
            <button type="button" className="btn btn-sm" disabled={!folderName.trim()} onClick={async () => { await saveFolder({ id: newId(), name: folderName.trim() }); setFolderName(''); void reload(); }}>Add</button>
          </div>
          {folder !== 'all' && folder !== 'none' && <button type="button" className="btn btn-sm" onClick={async () => { if (!window.confirm('Delete this folder? Its lessons move to No folder.')) return; for (const l of lessons.filter((x) => x.folderId === folder)) await saveProcedure({ ...l, folderId: null } as unknown as Procedure); await deleteFolder(folder); setFolder('all'); void reload(); }}>Delete folder</button>}
        </nav>
        <div className="dp-files">
          <div className="dp-row">
            <button type="button" className="btn btn-sm" onClick={() => leave(blankLesson())}>New lesson</button>
            <button type="button" className="btn btn-sm" onClick={() => file.current?.click()}>Open a file</button>
            <input ref={file} type="file" accept=".json,application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { leave({ ...asLesson(JSON.parse(await f.text())), id: newId(), saved: false, folderId: null, code: undefined }); } catch { window.alert('That file is not a lesson.'); } }} />
          </div>
          {shown.length === 0 ? <p className="dp-muted">Nothing saved here yet.</p> : (
            <ul className="dp-file-list">
              {shown.map((l) => (
                <li key={l.id}>
                  <button type="button" className="dp-file" onClick={() => leave(l)}>
                    <strong>{l.title}{l.id === current.id ? ' (open now)' : ''}</strong>
                    <span className="dp-muted">{l.tabs.length} tabs · code {l.code ?? '-'} · {folders.find((f) => f.id === l.folderId)?.name ?? 'No folder'} · {new Date(l.updatedAt).toLocaleDateString()}</span>
                  </button>
                  <select aria-label={`Move ${l.title} to a folder`} value={l.folderId ?? ''} onChange={async (e) => { await saveProcedure({ ...l, folderId: e.target.value || null } as unknown as Procedure); void reload(); }}>
                    <option value="">No folder</option>
                    {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  <button type="button" className="btn btn-sm" onClick={() => download(l)}>Download</button>
                  <button type="button" className="btn btn-sm" onClick={async () => { if (window.confirm(`Delete "${l.title}"?`)) { await deleteProcedure(l.id); void reload(); } }}>Delete</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Reports({ lesson, onClose }: { lesson: Lesson; onClose: () => void }) {
  const [list, setList] = useState<Session[]>(() => readReports(lesson.id).sort((a, b) => b.startedAt.localeCompare(a.startedAt)));
  const [pick, setPick] = useState<string | null>(list[0]?.id ?? null);
  const s = list.find((x) => x.id === pick);
  const stops = stopsOf(lesson);
  const csv = () => { if (!s) return; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([reportCsv(lesson, s)], { type: 'text/csv' })); a.download = `${lesson.title} ${s.startedAt.slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href); };
  return (
    <Modal title={`Reports: ${lesson.title}`} onClose={onClose} wide>
      {list.length === 0 ? <p className="dp-muted">No reports yet. A report is made each time you present and share this lesson: it keeps every student's work, by the name they signed in with.</p> : (
        <div className="ln-reports">
          <nav className="dp-folders" aria-label="Times this lesson was shared">
            {list.map((x) => <button key={x.id} type="button" className={`dp-folder${x.id === pick ? ' on' : ''}`} onClick={() => setPick(x.id)}>{new Date(x.startedAt).toLocaleString()}<br /><span className="dp-muted">{Object.keys(x.students).length} students · code {x.code}</span></button>)}
          </nav>
          {s && (
            <div className="ln-report">
              <div className="dp-row">
                <button type="button" className="btn btn-sm btn-primary" onClick={csv}>Download (spreadsheet)</button>
                <button type="button" className="btn btn-sm" onClick={() => window.print()}>Print</button>
                <button type="button" className="btn btn-sm" onClick={() => { if (!window.confirm('Delete this report?')) return; const next = list.filter((x) => x.id !== s.id); writeReports(lesson.id, next); setList(next); setPick(next[0]?.id ?? null); }}>Delete report</button>
              </div>
              {Object.values(s.students).length === 0 && <p className="dp-muted">No student work was sent during this share.</p>}
              {Object.values(s.students).map((st) => (
                <section key={st.name} className="ln-report-student">
                  <h3>{st.name}</h3>
                  <table className="ln-table">
                    <thead><tr><th>Tab</th><th>Activity</th><th>Work</th><th>Right</th></tr></thead>
                    <tbody>
                      {stops.filter(({ activity }) => st.work[activity.id]).map(({ tab, activity }) => {
                        const sum = summarize(activity, st.work[activity.id].resp);
                        return <tr key={activity.id}><td>{tab.title}</td><td>{activity.title}</td><td>{sum.text}</td><td>{sum.total ? `${sum.right} of ${sum.total}` : ''}</td></tr>;
                      })}
                    </tbody>
                  </table>
                </section>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
