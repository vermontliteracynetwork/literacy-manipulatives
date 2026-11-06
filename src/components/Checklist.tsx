// Checklist on the whiteboard (her request 2026-11-06: "in insert, add a checklist that has click select checks,
// left align list. easy view and edit modes. for share access, can help keep in track for capitilization,
// punctuation, requried words, etc."). View mode: tap a line to check it off. Edit mode: type the lines, add or
// remove them, or add a common one with one tap.
import { useState } from 'react';
import { Icon } from './Icon';

export interface CheckLine { id: string; text: string; done?: boolean }

export const CHECKLIST_STARTERS = [
  'Capital letter at the start',
  'Capital letters for names and I',
  'End punctuation ( . ? ! )',
  'Required words: ',
  'Complete sentence (who + what they do)',
  'Spaces between words',
  'Spelling checked',
  'Read it out loud',
];

export const newCheckLine = (text: string): CheckLine => ({ id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, text });
export const defaultChecklist = (): CheckLine[] => [CHECKLIST_STARTERS[0], CHECKLIST_STARTERS[2], CHECKLIST_STARTERS[3]].map(newCheckLine);

export function ChecklistWidget({ x, y, title, lines, ticks, canEdit, selected, setRef, onPointerDown, onPointerMove, onPointerUp, onDoubleClick, onToggle, onClearTicks, onChange }: {
  x: number; y: number;
  title: string;
  lines: CheckLine[];
  ticks: Record<string, boolean>; // what's checked on this screen
  canEdit: boolean;
  selected: boolean;
  setRef: (el: HTMLDivElement | null) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onDoubleClick: () => void;
  onToggle: (id: string) => void;
  onClearTicks: () => void;
  onChange: (patch: { title?: string; lines?: CheckLine[] }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const edit = editing && canEdit;
  const stop = (e: React.PointerEvent) => e.stopPropagation();
  const doneCount = lines.filter((l) => ticks[l.id]).length;
  const setLine = (id: string, text: string) => onChange({ lines: lines.map((l) => (l.id === id ? { ...l, text } : l)) });
  const move = (i: number, by: number) => {
    const next = [...lines];
    const [l] = next.splice(i, 1);
    next.splice(i + by, 0, l);
    onChange({ lines: next });
  };
  return (
    <div ref={setRef} className={`lm-checklist${selected ? ' selected' : ''}${edit ? ' editing' : ''}`} style={{ left: x, top: y }}>
      <div
        className="lm-checklist-head"
        role="button"
        tabIndex={0}
        aria-label="Move checklist (double tap for settings)"
        title="Drag to move"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
      >
        {edit ? (
          <input className="lm-checklist-title-input" value={title} placeholder="Checklist" aria-label="Checklist title" onPointerDown={stop} onChange={(e) => onChange({ title: e.target.value })} />
        ) : (
          <span className="lm-checklist-title">{title.trim() || 'Checklist'}</span>
        )}
        {!edit && lines.length > 0 && <span className="lm-checklist-count">{doneCount}/{lines.length}</span>}
        {canEdit && (
          <button type="button" className={`lm-checklist-mode${edit ? ' on' : ''}`} onPointerDown={stop} onClick={() => setEditing(!edit)} aria-pressed={edit} title={edit ? 'Done editing' : 'Edit the list'}>
            {edit ? 'Done' : <><Icon name="pencil" size={14} /> Edit</>}
          </button>
        )}
      </div>
      {edit ? (
        <div className="lm-checklist-body" onPointerDown={stop}>
          {lines.map((l, i) => (
            <div key={l.id} className="lm-checklist-edit-row">
              <input value={l.text} placeholder="Type a step" aria-label={`Line ${i + 1}`} onChange={(e) => setLine(l.id, e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onChange({ lines: [...lines.slice(0, i + 1), newCheckLine(''), ...lines.slice(i + 1)] }); } }} />
              <button type="button" className="lm-checklist-icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move line ${i + 1} up`} title="Move up">↑</button>
              <button type="button" className="lm-checklist-icon" onClick={() => move(i, 1)} disabled={i === lines.length - 1} aria-label={`Move line ${i + 1} down`} title="Move down">↓</button>
              <button type="button" className="lm-checklist-icon" onClick={() => onChange({ lines: lines.filter((x) => x.id !== l.id) })} aria-label={`Remove line ${i + 1}`} title="Remove">×</button>
            </div>
          ))}
          <button type="button" className="lm-checklist-add" onClick={() => onChange({ lines: [...lines, newCheckLine('')] })}>+ Add a line</button>
          <div className="lm-checklist-starters" aria-label="Add a common step">
            {CHECKLIST_STARTERS.filter((t) => !lines.some((l) => l.text.trim().startsWith(t.trim()))).map((t) => (
              <button key={t} type="button" onClick={() => onChange({ lines: [...lines, newCheckLine(t)] })}>+ {t.trim()}</button>
            ))}
          </div>
        </div>
      ) : (
        <div className="lm-checklist-body" onPointerDown={stop}>
          {lines.length === 0 && <p className="lm-checklist-empty">{canEdit ? 'Tap Edit to add steps.' : 'No steps yet.'}</p>}
          {lines.map((l) => (
            <button key={l.id} type="button" role="checkbox" aria-checked={!!ticks[l.id]} className={`lm-checklist-row${ticks[l.id] ? ' done' : ''}`} onClick={() => onToggle(l.id)}>
              <span className="lm-checklist-box" aria-hidden="true">{ticks[l.id] && <svg viewBox="0 0 24 24" width="16" height="16"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></svg>}</span>
              <span className="lm-checklist-text">{l.text.trim() || '(empty)'}</span>
            </button>
          ))}
          {doneCount > 0 && <button type="button" className="lm-checklist-clear" onClick={onClearTicks}>Clear checks</button>}
        </div>
      )}
    </div>
  );
}
