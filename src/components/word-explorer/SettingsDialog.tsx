import { useEffect, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { hashPin, isLocked, PRESETS, type WxSettings } from '../../lib/word-explorer/settings';
import { PATTERNS, patternLabel } from '../../lib/word-explorer/phonics';

// Settings (spec section 9 and Phase 5): per student (per device until accounts exist). In Teacher view every
// setting has a Lock button; a locked setting shows to students as set by their teacher. Teacher view needs the
// teacher PIN once one is set.

type Option<T> = [T, string];
type Key = keyof WxSettings;

export function SettingsDialog({ settings, onChange, onClose }: { settings: WxSettings; onChange: (s: WxSettings) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pinAsk, setPinAsk] = useState(false);
  const [pin, setPin] = useState('');
  const [pinMsg, setPinMsg] = useState('');
  const [newPin, setNewPin] = useState('');
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const items = [...ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), select, input, a')];
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('keydown', key); before?.focus(); };
  }, [onClose]);
  const teacher = settings.teacherView;
  const set = <K extends Key>(k: K, v: WxSettings[K]) => onChange({ ...settings, [k]: v });
  const toggleLock = (k: Key) => onChange({ ...settings, locks: settings.locks.includes(k) ? settings.locks.filter((x) => x !== k) : [...settings.locks, k] });

  function Choice<K extends Key>({ k, label, options }: { k: K; label: string; options: Option<WxSettings[K]>[] }) {
    const locked = isLocked(settings, k);
    return (
      <fieldset className="wx-choice" disabled={locked}>
        <legend>{label}</legend>
        {locked && <p className="wx-hint">Your teacher set this.</p>}
        <div className="wx-choice-row">
          {options.map(([v, name]) => (
            <button key={String(v)} type="button" className={`wx-btn${settings[k] === v ? ' wx-btn-primary' : ''}`} aria-pressed={settings[k] === v} onClick={() => set(k, v)}>
              {settings[k] === v && <Icon name="check" size={20} />}<span>{name}</span>
            </button>
          ))}
          {teacher && (
            <button type="button" className={`wx-btn wx-btn-small${settings.locks.includes(k) ? ' wx-btn-primary' : ''}`} aria-pressed={settings.locks.includes(k)} onClick={() => toggleLock(k)}>
              {settings.locks.includes(k) ? 'Locked for students' : 'Lock'}
            </button>
          )}
        </div>
      </fieldset>
    );
  }

  const turnTeacher = (on: boolean) => {
    if (!on) { set('teacherView', false); return; }
    if (settings.pinHash) { setPinAsk(true); setPinMsg(''); return; }
    set('teacherView', true);
  };

  return (
    <div className="wx-dialog-back" onClick={onClose}>
      <div ref={ref} className="wx-dialog" role="dialog" aria-modal="true" aria-labelledby="wx-settings-title" onClick={(e) => e.stopPropagation()}>
        <div className="wx-dialog-head">
          <h2 id="wx-settings-title" className="wx-h1">Settings</h2>
          <button type="button" className="wx-btn" onClick={onClose}><Icon name="close" size={22} /><span>Close</span></button>
        </div>
        <h3 className="wx-h2">Seeing</h3>
        <Choice k="theme" label="Colors" options={[['light', 'Light'], ['dark', 'Dark'], ['contrast', 'High contrast']]} />
        <Choice k="textSize" label="Text size" options={[['medium', 'Medium'], ['large', 'Large'], ['xl', 'Extra large']]} />
        <Choice k="lineSpacing" label="Line spacing" options={[['standard', 'Standard'], ['more', 'More'], ['most', 'Most']]} />
        <Choice k="spacing" label="Letter and word spacing" options={[['standard', 'Standard'], ['wider', 'Wider'], ['widest', 'Widest']]} />
        <Choice k="font" label="Font (a personal choice)" options={[['inclusive', 'Inclusive Sans'], ['dyslexic', 'OpenDyslexic'], ['system', 'This device\'s font']]} />
        <Choice k="buttonSize" label="Button size" options={[['standard', 'Standard'], ['xl', 'Extra large']]} />
        <Choice k="reduceMotion" label="Reduce motion" options={[[true, 'On'], [false, 'Off']]} />
        <Choice k="calm" label="Calm mode (hides extras)" options={[[false, 'Off'], [true, 'On']]} />
        <Choice k="preset" label="Word page view" options={PRESETS.map(([id, name]) => [id, name] as Option<WxSettings['preset']>)} />
        <p className="wx-hint">{PRESETS.find(([id]) => id === settings.preset)?.[2]}</p>
        <h3 className="wx-h2">Hearing</h3>
        <Choice k="speed" label="Reading speed" options={[[0.7, 'Slower'], [0.9, 'Normal'], [1.1, 'Faster']]} />
        <Choice k="sayButtons" label="Say button names when I tap them" options={[[true, 'On'], [false, 'Off']]} />

        <h3 className="wx-h2">Teacher</h3>
        <fieldset className="wx-choice">
          <legend>Teacher view (drafts, review buttons, sources, locks)</legend>
          <div className="wx-choice-row">
            <button type="button" className={`wx-btn${!teacher ? ' wx-btn-primary' : ''}`} aria-pressed={!teacher} onClick={() => turnTeacher(false)}>Off</button>
            <button type="button" className={`wx-btn${teacher ? ' wx-btn-primary' : ''}`} aria-pressed={teacher} onClick={() => turnTeacher(true)}>On</button>
          </div>
          {pinAsk && !teacher && (
            <form className="wx-pin" onSubmit={(e) => { e.preventDefault(); if (hashPin(pin) === settings.pinHash) { setPinAsk(false); setPin(''); set('teacherView', true); } else setPinMsg('That PIN is not right.'); }}>
              <label className="wx-select-label">Teacher PIN<input className="wx-input" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} /></label>
              <button type="submit" className="wx-btn wx-btn-primary">Unlock</button>
              {pinMsg && <p role="alert">{pinMsg}</p>}
            </form>
          )}
        </fieldset>
        {teacher && (
          <>
            <form className="wx-pin" onSubmit={(e) => { e.preventDefault(); if (newPin.trim().length >= 4) { set('pinHash', hashPin(newPin.trim())); setNewPin(''); setPinMsg('PIN saved.'); } else setPinMsg('Use at least 4 digits or letters.'); }}>
              <label className="wx-select-label">{settings.pinHash ? 'Change the teacher PIN' : 'Set a teacher PIN, so students cannot turn on Teacher view or change locked settings'}
                <input className="wx-input" type="password" autoComplete="off" value={newPin} onChange={(e) => setNewPin(e.target.value)} /></label>
              <button type="submit" className="wx-btn">Save PIN</button>
              {pinMsg && <p role="status">{pinMsg}</p>}
            </form>
            <Choice k="liveLookups" label="Allow live lookups (outside dictionaries for words this site does not have; also used by Write mode and the whiteboard)" options={[[false, 'Off'], [true, 'On']]} />
            <h3 className="wx-h2">Word of the Day</h3>
            <Choice k="wotdFor" label="Who gets which word" options={[['class', 'One word for the whole class'], ['student', 'A different word on each student device']]} />
            <Choice k="wotdFrom" label="Choose words from" options={[['any', 'Any approved word'], ['tier1', 'Tier 1'], ['tier2', 'Tier 2'], ['tier3', 'Tier 3'], ['pattern', 'A spelling pattern'], ['root', 'The root of the week']]} />
            {settings.wotdFrom === 'pattern' && (
              <label className="wx-select-label">Spelling pattern
                <select className="wx-input" value={settings.wotdPattern} onChange={(e) => onChange({ ...settings, wotdPattern: e.target.value })}>
                  {PATTERNS.filter((p) => !p.extra).map((p) => <option key={p.id} value={p.id}>{patternLabel(p)}</option>)}
                </select>
              </label>
            )}
            <Choice k="wotdRepeatDays" label="Do not repeat a word for" options={[[7, '7 days'], [30, '30 days'], [90, '90 days']]} />
          </>
        )}
        <p><a className="wx-btn" href="/words?view=sources">Sources and licenses{teacher ? ', and problem reports' : ''}</a></p>
      </div>
    </div>
  );
}
