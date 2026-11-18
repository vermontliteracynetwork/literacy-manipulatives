import './lessons.css';
import '../procedures/procedures.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadEngine } from 'symbolic-grammar-engine';
import LiteracyManipulatives, { type BoardData } from '../../LiteracyManipulatives';
import { HomeButton } from '../HomeButton';
import { ActivityEditor, ActivityView, FormulaPicker, SymbolPicker } from './Activities';
import { Progress } from './Progress';
import {
  PRESETS, TAB_KINDS, asLesson, blankLesson, copyTab, newActivity, newCode, newId, newTab, stopsOf, tabKindName,
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
  const [lesson, setLesson] = useState<Lesson>(() => readOpen() ?? { ...blankLesson(), code: newCode() });
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState<Mode>('edit');
  const [tabId, setTabId] = useState(lesson.tabs[0]?.id ?? '');
  const [actId, setActId] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(() => new Set(lesson.tabs.slice(0, 2).map((t) => t.id)));
  const [dialog, setDialog] = useState<null | 'library' | 'save' | 'settings' | 'reports' | { catalog: string }>(null);
  const [msg, setMsg] = useState('');
  const [, setReady] = useState(0);
  useEffect(() => { document.title = 'Daily Lesson'; void loadEngine().then(() => setReady((n) => n + 1)).catch(() => undefined); }, []);
  useEffect(() => { const t = window.setTimeout(() => writeOpen(lesson), 400); return () => window.clearTimeout(t); }, [lesson]);

  const change = useCallback((fn: (l: Lesson) => Lesson) => { setLesson((l) => fn(l)); setDirty(true); }, []);
  const tab = lesson.tabs.find((t) => t.id === tabId) ?? lesson.tabs[0];
  const where = (id: string | null) => { for (const t of lesson.tabs) for (const s of t.sections) { const a = s.activities.find((x) => x.id === id); if (a) return { t, s, a }; } return null; };
  const sel = where(actId);

  const mapTabs = (fn: (t: Tab) => Tab) => change((l) => ({ ...l, tabs: l.tabs.map(fn) }));
  const updateTab = (id: string, patch: Partial<Tab>) => mapTabs((t) => (t.id === id ? { ...t, ...patch } : t));
  const updateSection = (tid: string, sid: string, patch: Partial<Section>) => mapTabs((t) => (t.id === tid ? { ...t, sections: t.sections.map((s) => (s.id === sid ? { ...s, ...patch } : s)) } : t));
  const updateActivity = (id: string, patch: Partial<Activity>) => mapTabs((t) => ({ ...t, sections: t.sections.map((s) => ({ ...s, activities: s.activities.map((a) => (a.id === id ? { ...a, ...patch } : a)) })) }));
  const toggle = (id: string) => setOpen((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const addTab = (kind: TabKind) => { const t = newTab(kind, lesson.focus); change((l) => ({ ...l, tabs: [...l.tabs, t] })); setTabId(t.id); setActId(null); setOpen((o) => new Set(o).add(t.id)); };
  const dupTab = (t: Tab) => { const c = copyTab(t); change((l) => { const tabs = [...l.tabs]; tabs.splice(tabs.findIndex((x) => x.id === t.id) + 1, 0, c); return { ...l, tabs }; }); setTabId(c.id); setActId(null); setOpen((o) => new Set(o).add(c.id)); };
  const delTab = (t: Tab) => { if (lesson.tabs.length <= 1 || !window.confirm(`Delete the tab "${t.title}" and its activities?`)) return; change((l) => ({ ...l, tabs: l.tabs.filter((x) => x.id !== t.id) })); setTabId(lesson.tabs.find((x) => x.id !== t.id)!.id); setActId(null); };
  const moveTab = (t: Tab, d: -1 | 1) => change((l) => { const tabs = [...l.tabs]; const i = tabs.findIndex((x) => x.id === t.id); const j = i + d; if (j < 0 || j >= tabs.length) return l; [tabs[i], tabs[j]] = [tabs[j], tabs[i]]; return { ...l, tabs }; });
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
            ? <span className="ln-live" title={`Students go to ${joinUrl} and type this code`}>Join code <strong>{host.code}</strong> · {host.students.length} joined <button type="button" className="btn btn-sm" onClick={() => void host.stop()}>Stop sharing</button></span>
            : <button type="button" className="btn btn-sm btn-primary" disabled={!shareConfigured || host.status === 'starting'} title={shareConfigured ? `Students join at ${joinUrl}` : "Sharing isn't set up on this site yet"} onClick={() => void startShare()}>{host.status === 'starting' ? 'Starting...' : `Share with students (code ${lesson.code ?? 'new'})`}</button>}
          <button type="button" className={`btn btn-sm${notesOpen ? ' btn-primary' : ''}`} aria-pressed={notesOpen} onClick={() => setNotesOpen((x) => !x)}>Notes and students</button>
          <button type="button" className="btn btn-sm" onClick={() => { void document.documentElement.requestFullscreen?.().catch(() => undefined); }}>Full screen</button>
        </header>
        {host.error && <p className="ln-error" role="alert">{host.error}</p>}
        <div className="ln-present-body">
          <div className="ln-stage-wrap">
            <Progress lesson={lesson} at={a.id} done={done} view={lesson.progress} onPick={(id) => go(stops.findIndex((s) => s.activity.id === id))} />
            <main className="ln-stage" aria-label={a.title}>
              <h1 className="ln-stage-title"><span className="ln-stage-tab">{stop.tab.title}</span> {a.title}
                <button type="button" className={`btn btn-sm ln-access${a.access === 'do' ? ' do' : ''}`} title="Switch what students can do on this activity" onClick={() => updateActivity(a.id, { access: a.access === 'do' ? 'view' : 'do' })}>{a.access === 'do' ? 'Students do it' : 'Students watch'}</button>
              </h1>
              <ActivityView key={a.id} a={a} lesson={lesson} quiet={stop.tab.kind === 'assessment'} resp={teacherResp[a.id] ?? {}} set={(r) => setTeacherResp((m) => ({ ...m, [a.id]: r }))} interactive teacher />
            </main>
            <footer className="ln-foot">
              <button type="button" className="btn ln-big" disabled={at === 0} onClick={() => go(at - 1)}>Back</button>
              <span className="ln-muted">{at + 1} of {stops.length}</span>
              <button type="button" className="btn btn-primary ln-big" disabled={at >= stops.length - 1} onClick={() => go(at + 1)}>Next</button>
            </footer>
          </div>
          {notesOpen && (
            <aside className="ln-teacher" aria-label="Teacher only">
              <h2 className="ln-side-h">Only you see this</h2>
              {(stop.tab.notes || a.notes) ? <div className="ln-notes">{stop.tab.notes && <p>{stop.tab.notes}</p>}{a.notes && <p>{a.notes}</p>}</div> : <p className="dp-muted">No notes for this activity.</p>}
              <h2 className="ln-side-h">Students {host.status === 'live' ? `(${host.students.length})` : ''}</h2>
              {host.status !== 'live' ? <p className="dp-muted">Share with students to see their work live. They join on the join page with the lesson's code.</p>
                : host.students.length === 0 ? <p className="dp-muted">Waiting for students. They go to {joinUrl} and type {host.code}.</p>
                : a.access !== 'do' ? (
                  <div className="ln-work-grid">
                    <p className="dp-muted">Students are watching. Tap "Students watch" above to let them do this activity.</p>
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
            </aside>
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
        <span style={{ flex: 1 }} />
        <span className="dp-save-state" role="status">{msg || (lesson.saved ? (dirty ? 'Unsaved changes' : 'Saved') : 'Not saved')}</span>
        <span className="ln-code-chip" title="Students type this code on the join page when you present and share">Join code {lesson.code ?? '-'}</span>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => (lesson.saved ? void save() : setDialog('save'))}>Save</button>
        <button type="button" className="btn btn-sm" onClick={() => setDialog('save')}>Save as</button>
        <button type="button" className="btn btn-sm" onClick={() => setDialog('library')}>Open</button>
        <button type="button" className="btn btn-sm" onClick={() => setDialog('reports')}>Reports</button>
        <button type="button" className="btn btn-sm" onClick={() => setDialog('settings')}>Lesson settings</button>
      </header>
      <div className="ln-body">
        <nav className="ln-nav" aria-label="Lesson tabs">
          {lesson.tabs.map((t, ti) => {
            const isOpen = open.has(t.id);
            return (
              <section key={t.id} className={`ln-tab${t.id === tab?.id ? ' on' : ''}`}>
                <div className="ln-tab-head">
                  <button type="button" className="ln-tab-btn" aria-expanded={isOpen} onClick={() => { setTabId(t.id); setActId(null); if (!isOpen || t.id === tab?.id) toggle(t.id); }}>
                    <span className="ln-caret" aria-hidden>{isOpen ? '▾' : '▸'}</span>
                    <span className="ln-tab-title">{t.title}</span>
                    <span className="ln-tab-kind">{tabKindName(t.kind)}</span>
                  </button>
                </div>
                {isOpen && (
                  <div className="ln-tab-body">
                    {t.sections.map((s) => (
                      <div key={s.id} className="ln-sec">
                        <p className="ln-sec-title">{s.title}</p>
                        <ul>{s.activities.map((a) => <li key={a.id}><button type="button" className={`ln-item${a.id === actId ? ' on' : ''}`} onClick={() => { setTabId(t.id); setActId(a.id); }}>{a.title}{a.access === 'do' && <span className="ln-dot" title="Students do it" />}</button></li>)}</ul>
                      </div>
                    ))}
                    <div className="ln-tab-tools">
                      <button type="button" className="btn btn-sm" onClick={() => dupTab(t)}>Duplicate tab</button>
                      <button type="button" className="btn btn-sm" onClick={() => moveTab(t, -1)} disabled={ti === 0} aria-label="Move tab up">Up</button>
                      <button type="button" className="btn btn-sm" onClick={() => moveTab(t, 1)} disabled={ti === lesson.tabs.length - 1} aria-label="Move tab down">Down</button>
                      <button type="button" className="btn btn-sm" onClick={() => delTab(t)} disabled={lesson.tabs.length <= 1}>Delete</button>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
          <label className="dp-field ln-add-tab"><span>Add a tab</span>
            <select value="" onChange={(e) => { if (e.target.value) addTab(e.target.value as TabKind); }}>
              <option value="">Choose a tab</option>
              {TAB_KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.name}</option>)}
            </select>
          </label>
        </nav>

        {sel ? (
          <>
            <main className="ln-main">
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
              <div className="ln-preview">
                <p className="ln-preview-label">What students see{sel.a.access === 'do' ? ' and do' : ''}</p>
                <h1 className="ln-stage-title">{sel.a.title}</h1>
                {sel.a.engine === 'board' && boardEmbed
                  ? <div className="ln-board"><LiteracyManipulatives key={sel.a.id} embed={boardEmbed} /></div>
                  : <ActivityView key={sel.a.id + JSON.stringify(sel.a.data).length} a={sel.a} lesson={lesson} resp={teacherResp[sel.a.id] ?? {}} set={(r) => setTeacherResp((m) => ({ ...m, [sel.a.id]: r }))} interactive teacher />}
              </div>
            </main>
            <aside className="ln-panel" aria-label="Edit this activity">
              <h2 className="dp-panel-h">Edit this activity</h2>
              <ActivityEditor a={sel.a} onChange={(patch) => updateActivity(sel.a.id, patch)} />
            </aside>
          </>
        ) : tab ? (
          <main className="ln-main ln-cards-page">
            <div className="ln-tab-edit">
              <label className="dp-field"><span>Tab name</span><input value={tab.title} onChange={(e) => updateTab(tab.id, { title: e.target.value })} /></label>
              <label className="dp-field"><span>Kind</span>
                <select value={tab.kind} onChange={(e) => updateTab(tab.id, { kind: e.target.value as TabKind })}>{TAB_KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.name}</option>)}</select>
              </label>
              <label className="dp-field"><span>Time</span><input value={tab.minutes ?? ''} placeholder="2 to 4 min" onChange={(e) => updateTab(tab.id, { minutes: e.target.value })} /></label>
              <button type="button" className="btn btn-sm btn-primary" onClick={() => present()}>Present this tab</button>
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
                      <span className="ln-acard-foot">{a.access === 'do' ? 'Students do it' : 'View only'}{a.minutes ? ` · ${a.minutes}` : ''}{a.scope ? ` · ${a.scope === 'lesson' ? 'Lesson-specific' : 'Cumulative review'}` : ''}</span>
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
            <div className="dp-row"><strong className="ln-code-big">{lesson.code ?? '-'}</strong><button type="button" className="btn btn-sm" onClick={() => change((l) => ({ ...l, code: newCode() }))}>New code</button></div>
            <small className="dp-muted">This lesson keeps its own code. Students type it on the join page ({window.location.origin}/join) when you present and share.</small>
          </div>
        </Modal>
      )}
      {dialog === 'save' && <SaveLesson lesson={lesson} onClose={() => setDialog(null)} onSave={(l) => { void save(l); setDialog(null); }} />}
      {dialog === 'library' && <LessonLibrary current={lesson} dirty={dirty} onOpen={openLesson} onClose={() => setDialog(null)} />}
      {dialog === 'reports' && <Reports lesson={lesson} onClose={() => setDialog(null)} />}
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
                <span className="ln-acard-foot">{p.access === 'do' ? 'Students do it' : 'View only'}{p.levels ? ` · Levels ${p.levels}` : ''}</span>
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
            <button type="button" className="btn btn-sm" onClick={() => leave({ ...blankLesson(), code: newCode() })}>New lesson</button>
            <button type="button" className="btn btn-sm" onClick={() => file.current?.click()}>Open a file</button>
            <input ref={file} type="file" accept=".json,application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { leave({ ...asLesson(JSON.parse(await f.text())), id: newId(), saved: false, folderId: null, code: newCode() }); } catch { window.alert('That file is not a lesson.'); } }} />
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
