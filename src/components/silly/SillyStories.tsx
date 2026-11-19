import '../lessons/lessons.css';
import '../procedures/procedures.css';
import './silly.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadEngine } from 'symbolic-grammar-engine';
import { HomeButton } from '../HomeButton';
import { ActivityEditor, ActivityView, withBlanks } from '../lessons/Activities';
import { CopyLink, Modal, SidePane } from '../lessons/DailyLesson';
import { StudentScreen } from '../lessons/LessonJoin';
import { Fit } from '../lessons/Fit';
import { asLesson, newActivity, newCode, newId, stopsOf, type Activity, type Lesson } from '../../lib/lessons/types';
import { summarize, type Resp } from '../../lib/lessons/check';
import { useLessonHost, type Pos, type Work } from '../../lib/lessons/live';
import { deleteProcedure, listProcedures, saveProcedure } from '../../lib/procedures/library';
import { shareConfigured } from '../../lib/share';
import { STARTER_STORIES, type StarterStory } from '../../lib/silly/stories';
import type { Procedure } from '../../lib/procedures/types';

// Silly Stories (her request 2026-11-19): a Mad Libs style app. The teacher builds a deck of silly stories (it starts
// with her 10), sets for each one which parts of speech students fill in and how many (3 adjectives, 2 nouns...), and
// the Symbolic Grammar Engine picks those words out of the story to become blanks. She presents the deck like slides;
// students join with the deck's own code (or its join link), fill in their words on their iPads and read their silly
// story, while she sees each student's story live. A deck is saved like a Daily Lesson (same format, its own library).

const OPEN_KEY = 'lm-silly-open';

function story(st: StarterStory): Activity {
  const a = newActivity('silly-story', { symbols: [], formulas: [] });
  return { ...a, title: st.title, about: 'A silly story to fill in.', data: withBlanks({ ...a.data, story: st.text, storyTitle: st.title, counts: { ...st.counts }, seed: st.id }) };
}
function blankDeck(): Lesson {
  return {
    v: 2, app: 'silly', id: newId(), title: 'Silly Stories', folderId: null, updatedAt: new Date().toISOString(), focus: { symbols: [], formulas: [] }, progress: 'bar',
    tabs: [{ id: newId(), kind: 'practice', title: 'Silly Stories', notes: '', sections: [{ id: newId(), title: 'Silly Stories', activities: STARTER_STORIES.map(story) }] }],
  };
}
const readOpen = (): Lesson | null => { try { const x = JSON.parse(sessionStorage.getItem(OPEN_KEY) ?? 'null'); return x ? asLesson(x) : null; } catch { return null; } };

function SillyEditor({ onPlay }: { onPlay: () => void }) {
  const [deck, setDeck] = useState<Lesson>(() => readOpen() ?? blankDeck());
  const [dirty, setDirty] = useState(false);
  const [sel, setSel] = useState<string | null>(null); // null: every story as a card (her request 2026-11-19)
  const [mode, setMode] = useState<'edit' | 'present'>('edit');
  const [dialog, setDialog] = useState<null | 'save' | 'open' | 'add'>(null);
  const [preview, setPreview] = useState(false);
  const [ready, setReady] = useState(0);
  useEffect(() => { document.title = 'Silly Stories'; void loadEngine().then(() => setReady((n) => n + 1)).catch(() => undefined); }, []);
  useEffect(() => { try { sessionStorage.setItem(OPEN_KEY, JSON.stringify(deck)); } catch { /* too big */ } }, [deck]);
  useEffect(() => {
    if (!deck.saved || !dirty) return;
    const t = window.setTimeout(() => { void saveProcedure({ ...deck, updatedAt: new Date().toISOString() } as unknown as Procedure).then(() => setDirty(false)); }, 1200);
    return () => window.clearTimeout(t);
  }, [deck, dirty]);

  const stories = deck.tabs[0]?.sections[0]?.activities ?? [];
  const change = useCallback((fn: (acts: Activity[]) => Activity[]) => {
    setDeck((d) => ({ ...d, tabs: d.tabs.map((t, i) => (i === 0 ? { ...t, sections: t.sections.map((s, j) => (j === 0 ? { ...s, activities: fn(s.activities) } : s)) } : t)) }));
    setDirty(true);
  }, []);
  // Once the word lists load, a story whose blanks were picked before they were ready gets them picked again.
  useEffect(() => { if (ready && stories.some((a) => !a.data.engineOk)) change((acts) => acts.map((a) => (a.data.engineOk ? a : { ...a, data: withBlanks(a.data) }))); }, [ready]);
  const current = sel ? stories.find((a) => a.id === sel) : undefined;
  const update = (id: string, patch: Partial<Activity>) => change((acts) => acts.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const move = (from: number, to: number) => change((acts) => { const n = [...acts]; const [m] = n.splice(from, 1); n.splice(to, 0, m); return n; });
  const remove = (a: Activity) => { if (!window.confirm(`Take "${a.title}" out of the deck?`)) return; change((acts) => acts.filter((x) => x.id !== a.id)); setSel(stories.find((x) => x.id !== a.id)?.id ?? null); };
  const add = (st: StarterStory | null) => {
    const a = st ? story(st) : { ...newActivity('silly-story', deck.focus), title: 'My silly story', data: withBlanks({ ...newActivity('silly-story', deck.focus).data, story: '', storyTitle: 'My silly story' }) };
    change((acts) => [...acts, a]); setSel(a.id); setDialog(null);
  };
  const save = async (title: string, asNew: boolean) => {
    const next: Lesson = { ...deck, id: asNew ? newId() : deck.id, title: title.trim() || 'Silly Stories', code: asNew || !deck.code ? newCode() : deck.code, saved: true, updatedAt: new Date().toISOString() };
    await saveProcedure(next as unknown as Procedure);
    setDeck(next); setDirty(false); setDialog(null);
  };

  // ---------- Present: the deck as slides, students follow along ----------
  const stops = useMemo(() => stopsOf(deck), [deck]);
  const [at, setAt] = useState(0);
  const [teacherResp, setTeacherResp] = useState<Record<string, Resp>>({});
  const [live, setLive] = useState<Record<string, Record<string, Work>>>({});
  const [zoom, setZoom] = useState<Work | null>(null);
  const stop = stops[Math.min(at, stops.length - 1)];
  const pos: Pos = { at: mode === 'present' ? stop?.activity.id ?? null : null, tabId: stop?.tab.id ?? null, teacherResp: stop ? teacherResp[stop.activity.id] ?? {} : {}, done: stops.slice(0, at).map((x) => x.activity.id), progress: 'bar' };
  const onWork = useCallback((w: Work) => setLive((m) => ({ ...m, [w.activityId]: { ...m[w.activityId], [w.from]: w } })), []);
  const onCode = useCallback((code: string) => { setDeck((d) => ({ ...d, code })); setDirty(true); }, []);
  const host = useLessonHost(deck, pos, onWork, onCode);
  const [spWork, setSpWork] = useState<Record<string, Resp>>({});

  if (mode === 'present' && stop) {
    const a = stop.activity;
    const work = Object.values(live[a.id] ?? {});
    return (
      <div className="ln ln-present">
        <header className="ln-bar">
          <button type="button" className="btn btn-sm" onClick={() => setMode('edit')}>Back to Edit</button>
          <span className="ln-title">{deck.title}</span>
          <span style={{ flex: 1 }} />
          {host.status === 'live'
            ? <span className="ln-live">Join code <strong>{host.code}</strong> · {host.students.length} joined <CopyLink code={host.code ?? ''} /> <button type="button" className="btn btn-sm" onClick={() => void host.stop()}>Stop sharing</button></span>
            : !deck.saved || !deck.code
              ? <button type="button" className="btn btn-sm btn-primary" onClick={() => { setMode('edit'); setDialog('save'); }}>Save and name the deck to share</button>
              : <button type="button" className="btn btn-sm btn-primary" disabled={!shareConfigured || host.status === 'starting'} onClick={() => void host.start()}>{host.status === 'starting' ? 'Starting...' : `Share with students (code ${deck.code})`}</button>}
          <button type="button" className="btn btn-sm" onClick={() => { void document.documentElement.requestFullscreen?.().catch(() => undefined); }}>Full screen</button>
        </header>
        {host.error && <p className="ln-error" role="alert">{host.error}</p>}
        <div className="ln-present-body">
          <div className="ln-stage-wrap">
            <main className="ln-stage ln-stage-fit" aria-label={a.title}>
              <Fit slide>
                <h1 className="ln-stage-title"><span className="ln-stage-tab">Story {at + 1} of {stops.length}</span> {a.title}</h1>
                <ActivityView key={a.id} a={a} lesson={deck} resp={teacherResp[a.id] ?? {}} set={(r) => setTeacherResp((m) => ({ ...m, [a.id]: r }))} interactive teacher />
              </Fit>
            </main>
            <footer className="ln-foot">
              <button type="button" className="btn ln-big" disabled={at === 0} onClick={() => setAt(at - 1)}>Back</button>
              <span className="ln-muted">{at + 1} of {stops.length}</span>
              <button type="button" className="btn btn-primary ln-big" disabled={at >= stops.length - 1} onClick={() => setAt(at + 1)}>Next story</button>
            </footer>
          </div>
          <SidePane id="silly-teacher" side="right" width={340} label="Students">
            <div className="ln-teacher">
              <h2 className="ln-side-h">Students {host.status === 'live' ? `(${host.students.length})` : ''}</h2>
              {host.status !== 'live' ? <p className="dp-muted">Share with students to see their silly stories as they write them.</p>
                : host.students.length === 0 ? <p className="dp-muted">Waiting for students. They open the join link or go to {window.location.origin}/join and type {host.code}.</p>
                : (
                  <div className="ln-work-grid">
                    {host.students.map((st) => {
                      const w = work.find((x) => x.from === st.id);
                      const sum = w ? summarize(a, w.resp) : null;
                      return (
                        <button key={st.id} type="button" className="ln-work" disabled={!w} onClick={() => w && setZoom(w)}>
                          <span className="ln-work-name">{st.name}</span>
                          <span className="ln-work-text">{sum?.text || 'Not started'}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
            </div>
          </SidePane>
        </div>
        {zoom && <Modal title={`${zoom.name}: ${a.title}`} onClose={() => setZoom(null)} wide><div className="ln-zoom"><ActivityView a={a} lesson={deck} resp={{ ...zoom.resp, read: true }} set={() => {}} interactive={false} teacher /></div></Modal>}
      </div>
    );
  }

  return (
    <div className="ln ln-edit">
      <header className="ln-bar">
        <HomeButton />
        <span className="ln-app">Silly Stories</span>
        <button type="button" className="btn btn-sm" onClick={onPlay} title="Back to open play">Play</button>
        <input className="dp-doc-title-input" value={deck.title} onChange={(e) => { setDeck((d) => ({ ...d, title: e.target.value })); setDirty(true); }} aria-label="Deck name" />
        <button type="button" className="btn btn-sm btn-primary" onClick={() => { setAt(Math.max(0, current ? stories.findIndex((x) => x.id === current.id) : 0)); setMode('present'); }}>Present</button>
        <button type="button" className="btn btn-sm" onClick={() => { if (!current && stories[0]) setSel(stories[0].id); setPreview(true); }} disabled={!stories.length}>Preview as student</button>
        <span style={{ flex: 1 }} />
        <span className="dp-save-state" role="status">{deck.saved ? (dirty ? 'Saving...' : 'All changes saved') : 'Not saved yet'}</span>
        {deck.saved && deck.code && <><span className="ln-code-chip">Join code {deck.code}</span><CopyLink code={deck.code} /></>}
        {!deck.saved && <button type="button" className="btn btn-sm btn-primary" onClick={() => setDialog('save')}>Save</button>}
        <button type="button" className="btn btn-sm" onClick={() => setDialog('open')}>Open</button>
      </header>
      <div className="ln-body">
        <SidePane id="silly-nav" side="left" width={260} label="Stories">
          <div className="ln-nav">
            <section className="lm-category ln-plan-box" aria-label="Stories in this deck">
              <div className="lm-category-header ln-cat-head" style={{ background: '#C9EBD3' }}>
                <button type="button" className={`ln-cat-btn${!current ? ' on' : ''}`} onClick={() => setSel(null)} title="See every story as a card"><span>Stories ({stories.length})</span></button>
                <button type="button" className="ln-plus" aria-label="Add a story" title="Add a story" onClick={() => setDialog('add')}>+</button>
              </div>
              <ol className="ln-plan-list">
                {stories.map((a, i) => (
                  <li key={a.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/sl', String(i))}
                    onDragOver={(e) => { if (e.dataTransfer.types.includes('text/sl')) { e.preventDefault(); e.currentTarget.classList.add('drop'); } }}
                    onDragLeave={(e) => e.currentTarget.classList.remove('drop')}
                    onDrop={(e) => { e.currentTarget.classList.remove('drop'); const from = Number(e.dataTransfer.getData('text/sl')); if (!Number.isNaN(from)) move(from, i); }}>
                    <span className="ln-grip" aria-hidden>⋮⋮</span>
                    <button type="button" className={`ln-plan-item${a.id === current?.id ? ' on' : ''}`} onClick={() => setSel(a.id)}>
                      <span className="ln-plan-n sl-n">{i + 1}</span>{a.title}
                    </button>
                  </li>
                ))}
              </ol>
              <p className="ln-plan-tip">Drag to reorder.</p>
            </section>
          </div>
        </SidePane>
        {current ? (
          <>
            <main className="ln-main ln-main-fit">
              <div className="ln-crumbs">
                <button type="button" className="btn btn-sm" onClick={() => setSel(null)}>← All stories</button>
                <strong>{current.title}</strong>
                <span style={{ flex: 1 }} />
                <button type="button" className="btn btn-sm" onClick={() => remove(current)}>Take out of the deck</button>
              </div>
              <p className="ln-preview-label">What students see when you present</p>
              <Fit slide className="ln-preview-fit">
                <h1 className="ln-stage-title"><span className="ln-stage-tab">Story {stories.findIndex((x) => x.id === current.id) + 1}</span> {current.title}</h1>
                <ActivityView key={current.id + JSON.stringify(current.data).length} a={current} lesson={deck} resp={teacherResp[current.id] ?? {}} set={(r) => setTeacherResp((m) => ({ ...m, [current.id]: r }))} interactive teacher />
              </Fit>
            </main>
            <SidePane id="silly-panel" side="right" width={360} label="Story settings">
              <div className="ln-panel">
                <h2 className="dp-panel-h">Story settings</h2>
                <ActivityEditor a={current} lesson={deck} tabKind="practice" onChange={(patch) => update(current.id, patch)} />
              </div>
            </SidePane>
          </>
        ) : (
          <main className="ln-main">
            <h1 className="ln-dp-title">{deck.title}</h1>
            <p className="ln-muted">{stories.length} silly stories. Tap one to set it up, or Present to share the deck.</p>
            <div className="sl-cards">
              {stories.map((a, i) => {
                const n = Array.isArray(a.data.blanks) ? a.data.blanks.length : 0;
                return (
                  <button key={a.id} type="button" className="sl-card" onClick={() => setSel(a.id)}>
                    <span className="sl-card-kind">Silly Story {i + 1}</span>
                    <span className="sl-card-title">{a.title}</span>
                    <span className="sl-card-foot">{n} words to fill in</span>
                  </button>
                );
              })}
              <button type="button" className="sl-card sl-card-add" onClick={() => setDialog('add')}><span className="ln-acard-plus">+</span><span>Add a story</span></button>
            </div>
          </main>
        )}
      </div>

      {dialog === 'add' && (
        <Modal title="Add a story" onClose={() => setDialog(null)} wide>
          <div className="ln-cards">
            {STARTER_STORIES.map((st) => (
              <button key={st.id} type="button" className="ln-acard" onClick={() => add(st)}>
                <span className="ln-acard-name">{st.title}</span>
                <span className="ln-acard-about">{st.text.slice(0, 90)}...</span>
                <span className="ln-acard-foot">{stories.some((a) => a.title === st.title) ? 'In this deck' : ''}</span>
              </button>
            ))}
            <button type="button" className="ln-acard ln-acard-add" onClick={() => add(null)}><span className="ln-acard-plus">+</span><span>Write my own story</span></button>
          </div>
        </Modal>
      )}
      {dialog === 'save' && <SaveDeck deck={deck} onClose={() => setDialog(null)} onSave={(t, asNew) => void save(t, asNew)} />}
      {dialog === 'open' && <OpenDeck current={deck} dirty={dirty} onOpen={(d) => { setDeck(d); setSel(null); setDirty(false); setDialog(null); }} onClose={() => setDialog(null)} />}
      {preview && current && (
        <div className="ln-sp-back" role="dialog" aria-modal="true" aria-label="Preview as student">
          <div className="ln-sp-bar">
            <strong>Preview as student</strong>
            <span className="ln-muted">What a student sees on an iPad. Nothing is sent or saved.</span>
            <span style={{ flex: 1 }} />
            <button type="button" className="btn btn-sm" onClick={() => setPreview(false)}>Close preview</button>
          </div>
          <div className="ln-sp-ipad" style={{ transform: `scale(${Math.min(1, (window.innerWidth - 32) / 1052, (window.innerHeight - 150) / 796)})`, transformOrigin: 'top center' }}>
            <StudentScreen lesson={deck} stop={stops.find((x) => x.activity.id === current.id)!} done={[]} progress="bar" teacherResp={{}}
              resp={spWork[current.id] ?? {}} setResp={(r) => setSpWork((m) => ({ ...m, [current.id]: r }))} />
          </div>
        </div>
      )}
    </div>
  );
}

function SaveDeck({ deck, onClose, onSave }: { deck: Lesson; onClose: () => void; onSave: (title: string, asNew: boolean) => void }) {
  const [name, setName] = useState(deck.title);
  const [asNew, setAsNew] = useState(false);
  return (
    <Modal title="Save deck" onClose={onClose}>
      <label className="dp-field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
      {deck.saved && <label className="dp-check"><input type="checkbox" checked={asNew} onChange={(e) => setAsNew(e.target.checked)} /> Save as a new deck (its own join code)</label>}
      <p className="dp-muted">A saved deck gets its own join code, and every change saves by itself. Decks are kept in this browser.</p>
      <div className="dp-row"><button type="button" className="btn btn-primary" onClick={() => onSave(name, asNew)}>Save</button><button type="button" className="btn" onClick={onClose}>Cancel</button></div>
    </Modal>
  );
}

function OpenDeck({ current, dirty, onOpen, onClose }: { current: Lesson; dirty: boolean; onOpen: (d: Lesson) => void; onClose: () => void }) {
  const [decks, setDecks] = useState<Lesson[]>([]);
  const reload = () => listProcedures().then((p) => setDecks((p as unknown as (Lesson | Procedure)[]).map(asLesson).filter((l) => l.app === 'silly').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))).catch(() => undefined);
  useEffect(() => { void reload(); }, []);
  const leave = (d: Lesson) => { if (!dirty || window.confirm('This deck has unsaved changes. Open another one anyway?')) onOpen(d); };
  return (
    <Modal title="Open a deck" onClose={onClose}>
      <div className="dp-row"><button type="button" className="btn btn-sm" onClick={() => leave(blankDeck())}>New deck (the 10 stories)</button></div>
      {decks.length === 0 ? <p className="dp-muted">No saved decks yet.</p> : (
        <ul className="dp-file-list">
          {decks.map((d) => (
            <li key={d.id}>
              <button type="button" className="dp-file" onClick={() => leave(d)}>
                <strong>{d.title}{d.id === current.id ? ' (open now)' : ''}</strong>
                <span className="dp-muted">{stopsOf(d).length} stories · code {d.code ?? '-'} · {new Date(d.updatedAt).toLocaleDateString()}</span>
              </button>
              <button type="button" className="btn btn-sm" onClick={async () => { if (window.confirm(`Delete "${d.title}"?`)) { await deleteProcedure(d.id); void reload(); } }}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

// Silly Stories opens straight to open play (her request 2026-11-19: "the silly stories should open in a preview way so
// that students or teacher can open it quickly. it must be edited and shared as link to have a specific set of
// words/stories, etc. otherwise its open play"). Anyone taps a story card and plays it, with fresh random words each
// time. A set deck (her stories, her words) is made in "Edit and share a deck" and reaches students by its join link.
export function SillyStories() {
  const [view, setView] = useState<'play' | 'edit'>(() => { try { return new URLSearchParams(window.location.search).has('edit') || sessionStorage.getItem('lm-silly-view') === 'edit' ? 'edit' : 'play'; } catch { return 'play'; } });
  useEffect(() => { try { sessionStorage.setItem('lm-silly-view', view); } catch { /* not kept */ } }, [view]);
  return view === 'edit' ? <SillyEditor onPlay={() => setView('play')} /> : <SillyPlay onEdit={() => setView('edit')} />;
}

function SillyPlay({ onEdit }: { onEdit: () => void }) {
  const [ready, setReady] = useState(0);
  const [round, setRound] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [resp, setResp] = useState<Resp>({});
  useEffect(() => { document.title = 'Silly Stories'; void loadEngine().then(() => setReady((n) => n + 1)).catch(() => undefined); }, []);
  // New random words every time a story is opened.
  const stories = useMemo(() => STARTER_STORIES.map((st) => { const a = story(st); return { ...a, id: st.id, data: withBlanks({ ...a.data, seed: `${st.id}-${round}-${Date.now()}` }) }; }), [ready, round]);
  const current = stories.find((x) => x.id === pick);
  const open = (id: string) => { setRound((r) => r + 1); setResp({}); setPick(id); };
  const deck: Lesson = { ...blankDeck(), tabs: [{ id: 'play', kind: 'practice', title: 'Silly Stories', notes: '', sections: [{ id: 'play', title: 'Silly Stories', activities: stories }] }] };
  return (
    <div className="ln ln-edit sl-play">
      <header className="ln-bar">
        <HomeButton />
        <span className="ln-app">Silly Stories</span>
        {current && <button type="button" className="btn btn-sm" onClick={() => setPick(null)}>All stories</button>}
        <span style={{ flex: 1 }} />
        {current && <button type="button" className="btn btn-sm" onClick={() => open(current.id)}>New words</button>}
        <button type="button" className="btn btn-sm" onClick={onEdit} title="Teachers: pick the stories and words, then share the deck with its own join link">Edit and share a deck</button>
      </header>
      {current ? (
        <main className="ln-stage ln-stage-fit">
          <Fit>
            <h1 className="ln-stage-title">{current.title}</h1>
            <ActivityView key={`${current.id}-${round}`} a={current} lesson={deck} resp={resp} set={setResp} interactive />
          </Fit>
        </main>
      ) : (
        <main className="ln-main">
          <h1 className="ln-dp-title">Pick a silly story</h1>
          <p className="ln-muted">Fill in the words, then read your silly story.</p>
          <div className="sl-cards">
            {stories.map((a, i) => (
              <button key={a.id} type="button" className="sl-card" onClick={() => open(a.id)}>
                <span className="sl-card-kind">Silly Story {i + 1}</span>
                <span className="sl-card-title">{a.title}</span>
              </button>
            ))}
          </div>
        </main>
      )}
    </div>
  );
}
