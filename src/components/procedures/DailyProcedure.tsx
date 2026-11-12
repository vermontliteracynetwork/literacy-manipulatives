import './procedures.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import LiteracyManipulatives, { type BoardData } from '../../LiteracyManipulatives';
import { TemplateEditor, TemplateView } from './TemplatePages';
import { HomeButton } from '../HomeButton';
import { LibraryDialog, SaveDialog } from './Library';
import { KIND_NAMES, PHASES, blankData, newId, newPage, phaseOf, type PageKind, type Phase, type Procedure, type ProcPage } from '../../lib/procedures/types';
import { readOpen, saveProcedure, writeOpen } from '../../lib/procedures/library';
import { levelBDay1 } from '../../lib/procedures/levelB';

// Daily Procedure (her request 2026-11-12): a lesson's steps as tabs on the left, one page per step in the middle,
// a small toolbar on top. Edit mode: the right side holds the page's settings and, on a whiteboard page, all the
// board's materials. Learn mode: what students see when the teacher shares the screen (no notes, no editing panels).
// Procedures save to a library of folders when the teacher chooses Save.

type Mode = 'edit' | 'learn';
const KINDS: PageKind[] = ['goal', 'review-symbols', 'formula', 'activity', 'assessment', 'custom'];
const PHASE_KIND: Record<Phase, PageKind> = { Opening: 'goal', Review: 'review-symbols', Instruction: 'formula', Practice: 'activity', Application: 'activity', Assessment: 'assessment' };

export function DailyProcedure() {
  const [proc, setProc] = useState<Procedure>(() => readOpen() ?? levelBDay1());
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState<Mode>('edit');
  const [pageId, setPageId] = useState(proc.pages[0]?.id ?? '');
  const [boardView, setBoardView] = useState<Record<string, boolean>>({});
  const [panelOpen, setPanelOpen] = useState(true);
  const [dialog, setDialog] = useState<null | 'save' | 'open'>(null);
  const [message, setMessage] = useState('');
  const learn = mode === 'learn';
  const index = Math.max(0, proc.pages.findIndex((p) => p.id === pageId));
  const page = proc.pages[index];

  useEffect(() => { document.title = 'Daily Procedure'; }, []);
  useEffect(() => { const t = window.setTimeout(() => writeOpen(proc), 400); return () => window.clearTimeout(t); }, [proc]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty && proc.saved) e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, proc.saved]);

  const change = useCallback((fn: (p: Procedure) => Procedure) => { setProc((p) => fn(p)); setDirty(true); }, []);
  const updatePage = useCallback((id: string, patch: Partial<ProcPage>) => change((p) => ({ ...p, pages: p.pages.map((x) => (x.id === id ? { ...x, ...patch } : x)) })), [change]);
  const go = (i: number) => { const p = proc.pages[Math.max(0, Math.min(proc.pages.length - 1, i))]; if (p) setPageId(p.id); };

  // Learn mode: the arrow keys and Page Up/Down move between steps (not while typing on the board).
  useEffect(() => {
    if (!learn) return;
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, [contenteditable="true"], .lm-page')) return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
      if (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  const quickSave = async () => {
    if (!proc.saved) { setDialog('save'); return; }
    await saveProcedure(proc);
    setProc((p) => ({ ...p, saved: true }));
    setDirty(false);
    setMessage('Saved');
    window.setTimeout(() => setMessage(''), 2000);
  };
  const openProc = (p: Procedure) => { setProc(p); setPageId(p.pages[0]?.id ?? ''); setDirty(false); setBoardView({}); setDialog(null); };

  const addPage = (kind: PageKind, phase?: Phase) => {
    const np = newPage(kind, phase === 'Instruction' ? 'New formula' : phase && kind === 'activity' ? phase : undefined, phase);
    change((p) => {
      const pages = [...p.pages];
      // Into its phase: after that phase's last step (or where the phase belongs in the routine).
      const order = PHASES.map((x) => x.name);
      const ph = phaseOf(np);
      let at = -1;
      pages.forEach((x, i) => { if (order.indexOf(phaseOf(x)) <= order.indexOf(ph)) at = i; });
      pages.splice(at + 1, 0, np);
      return { ...p, pages };
    });
    setPageId(np.id);
    setPanelOpen(true);
  };
  const movePage = (d: -1 | 1) => change((p) => {
    const pages = [...p.pages];
    const j = index + d;
    if (j < 0 || j >= pages.length) return p;
    [pages[index], pages[j]] = [pages[j], pages[index]];
    return { ...p, pages };
  });
  const removePage = () => {
    if (proc.pages.length <= 1 || !window.confirm(`Delete the step "${page.title}"?`)) return;
    const next = proc.pages[index + 1] ?? proc.pages[index - 1];
    change((p) => ({ ...p, pages: p.pages.filter((x) => x.id !== page.id) }));
    setPageId(next.id);
  };
  const duplicatePage = () => {
    const copy: ProcPage = JSON.parse(JSON.stringify({ ...page, id: newId(), title: `${page.title} (copy)` }));
    change((p) => { const pages = [...p.pages]; pages.splice(index + 1, 0, copy); return { ...p, pages }; });
    setPageId(copy.id);
  };
  const setKind = (kind: PageKind) => {
    if (kind === page.kind) return;
    if (page.kind !== 'custom' && !window.confirm(`Change this step to ${KIND_NAMES[kind]}? Its template content will be cleared. The whiteboard and notes stay.`)) return;
    updatePage(page.id, { kind, data: blankData(kind) });
  };

  const showBoard = page ? page.kind === 'custom' || !!boardView[page.id] : false;
  const onBoard = useCallback((b: BoardData) => { if (page) updatePage(page.id, { board: b }); }, [page?.id, updatePage]);
  const embed = useMemo(() => (page ? { initial: page.board, onChange: onBoard, presenting: learn } : null), [page?.id, learn]);

  if (!page) return null;
  return (
    <div className={`dp${learn ? ' dp-learn' : ' dp-edit'}`}>
      <header className="dp-toolbar">
        <HomeButton />
        <span className="lm-sidebar-title">Daily Procedure</span>
        {learn ? <span className="dp-doc-title">{proc.title}</span>
          : <input className="dp-doc-title-input" value={proc.title} onChange={(e) => change((p) => ({ ...p, title: e.target.value }))} aria-label="Procedure name" />}
        <span className="lm-toolbar-divider" />
        <div className="dp-mode" role="radiogroup" aria-label="Mode">
          <button type="button" role="radio" aria-checked={!learn} className={`btn btn-sm${!learn ? ' btn-primary' : ''}`} onClick={() => setMode('edit')}>Edit</button>
          <button type="button" role="radio" aria-checked={learn} className={`btn btn-sm${learn ? ' btn-primary' : ''}`} onClick={() => setMode('learn')}>Learn</button>
        </div>
        {page.kind !== 'custom' && (
          <button type="button" className={`btn btn-sm${showBoard ? ' btn-primary' : ''}`} aria-pressed={showBoard} onClick={() => setBoardView((v) => ({ ...v, [page.id]: !v[page.id] }))}>
            {showBoard ? 'Back to the page' : 'Whiteboard'}
          </button>
        )}
        {learn && (
          <>
            <button type="button" className="btn btn-sm" onClick={() => go(index - 1)} disabled={index === 0}>Back</button>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => go(index + 1)} disabled={index === proc.pages.length - 1}>Next step</button>
          </>
        )}
        <span style={{ flex: 1 }} />
        {!learn && (
          <>
            <span className="dp-save-state" role="status">{message || (proc.saved ? (dirty ? 'Unsaved changes' : 'Saved') : 'Not saved')}</span>
            <button type="button" className="btn btn-sm btn-primary" onClick={quickSave}>Save</button>
            <button type="button" className="btn btn-sm" onClick={() => setDialog('save')}>Save as</button>
            <button type="button" className="btn btn-sm" onClick={() => setDialog('open')}>Open</button>
            <button type="button" className={`btn btn-sm${panelOpen ? ' btn-primary' : ''}`} aria-pressed={panelOpen} onClick={() => setPanelOpen((o) => !o)}>Page settings</button>
          </>
        )}
      </header>

      <div className="dp-body">
        <nav className="dp-steps" aria-label="Steps">
          {proc.subtitle && <p className="dp-steps-sub">{proc.subtitle}</p>}
          <div role="tablist" aria-orientation="vertical" className="dp-phases">
            {PHASES.map((ph) => {
              const steps = proc.pages.map((p, i) => ({ p, i })).filter(({ p }) => phaseOf(p) === ph.name);
              if (!steps.length && learn) return null;
              return (
                <section key={ph.name} className="dp-phase" aria-label={ph.name}>
                  <h2 className="dp-phase-name">{ph.name}</h2>
                  {!learn && <p className="dp-phase-about">{ph.about}</p>}
                  {steps.map(({ p, i }) => (
                    <button key={p.id} type="button" role="tab" aria-selected={p.id === page.id} className={`dp-step${p.id === page.id ? ' on' : ''}`} onClick={() => setPageId(p.id)}>
                      <span className="dp-step-n">Step {i + 1}</span>
                      <span className="dp-step-title">{p.title}</span>
                      {p.minutes && <span className="dp-step-min">{p.minutes}</span>}
                    </button>
                  ))}
                  {!learn && (
                    <button type="button" className="btn btn-sm dp-phase-add" onClick={() => addPage(PHASE_KIND[ph.name], ph.name)}>
                      {ph.name === 'Instruction' ? 'Add a formula' : `Add ${/^[AEIOU]/.test(ph.name) ? 'an' : 'a'} ${ph.name.toLowerCase()} step`}
                    </button>
                  )}
                </section>
              );
            })}
          </div>
          {!learn && (
            <div className="dp-step-tools">
              <label className="dp-field"><span>Add any page type</span>
                <select value="" onChange={(e) => { if (e.target.value) addPage(e.target.value as PageKind); }}>
                  <option value="">Choose a page type</option>
                  {KINDS.map((k) => <option key={k} value={k}>{KIND_NAMES[k]}</option>)}
                </select>
              </label>
              <div className="dp-row">
                <button type="button" className="btn btn-sm" onClick={() => movePage(-1)} disabled={index === 0} aria-label="Move this step up">Move up</button>
                <button type="button" className="btn btn-sm" onClick={() => movePage(1)} disabled={index === proc.pages.length - 1} aria-label="Move this step down">Move down</button>
              </div>
              <div className="dp-row">
                <button type="button" className="btn btn-sm" onClick={duplicatePage}>Duplicate</button>
                <button type="button" className="btn btn-sm" onClick={removePage} disabled={proc.pages.length <= 1}>Delete</button>
              </div>
            </div>
          )}
        </nav>

        <main className="dp-page" aria-label={`Step ${index + 1}: ${page.title}`}>
          {showBoard ? (
            <div className="dp-board">
              {embed && <LiteracyManipulatives key={`${page.id}-${mode}`} embed={embed} />}
            </div>
          ) : (
            <div className="dp-sheet">
              <h1 className="dp-page-title"><span className="dp-page-step">Step {index + 1}</span> {page.title}</h1>
              <TemplateView key={page.id} kind={page.kind} data={page.data} learn={learn} pageTitle={page.title} />
            </div>
          )}
        </main>

        {!learn && panelOpen && (
          <aside className="dp-panel" aria-label="Page settings">
            <h2 className="dp-panel-h">Step {index + 1} settings</h2>
            <label className="dp-field"><span>Step name (on its tab)</span><input value={page.title} onChange={(e) => updatePage(page.id, { title: e.target.value })} /></label>
            <label className="dp-field"><span>Time</span><input value={page.minutes ?? ''} placeholder="5 to 8 min" onChange={(e) => updatePage(page.id, { minutes: e.target.value })} /></label>
            <label className="dp-field"><span>Part of the routine</span>
              <select value={phaseOf(page)} onChange={(e) => updatePage(page.id, { phase: e.target.value as Phase })}>
                {PHASES.map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}
              </select>
            </label>
            <label className="dp-field"><span>Page type</span>
              <select value={page.kind} onChange={(e) => setKind(e.target.value as PageKind)}>
                <optgroup label="Set templates">{KINDS.filter((k) => k !== 'custom').map((k) => <option key={k} value={k}>{KIND_NAMES[k]}</option>)}</optgroup>
                <optgroup label="Your own design"><option value="custom">{KIND_NAMES.custom}</option></optgroup>
              </select>
            </label>
            {page.kind === 'custom'
              ? <p className="dp-muted">This page is a whiteboard. Its materials (grammar symbols, symbol sentences, morphemes, letter tiles, Insert for pictures, text and checklists) are on the right side of the board.</p>
              : <TemplateEditor kind={page.kind} data={page.data} onChange={(data) => updatePage(page.id, { data })} />}
            <label className="dp-field"><span>Teacher notes <span className="dp-muted">(only in Edit mode)</span></span>
              <textarea rows={12} value={page.notes} onChange={(e) => updatePage(page.id, { notes: e.target.value })} />
            </label>
          </aside>
        )}
      </div>

      {dialog === 'save' && <SaveDialog proc={proc} onClose={() => setDialog(null)} onSaved={(p) => { setProc(p); setDirty(false); setDialog(null); setMessage('Saved'); window.setTimeout(() => setMessage(''), 2000); }} />}
      {dialog === 'open' && <LibraryDialog current={proc} onClose={() => setDialog(null)} onOpen={openProc} />}
    </div>
  );
}

