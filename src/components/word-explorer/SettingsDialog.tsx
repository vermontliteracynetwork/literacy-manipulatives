import { useEffect, useRef } from 'react';
import { Icon } from '../Icon';
import type { WxSettings } from '../../lib/word-explorer/settings';

type Option<T> = [T, string];
function Choice<T extends string | number | boolean>({ label, value, options, onChange }: { label: string; value: T; options: Option<T>[]; onChange: (v: T) => void }) {
  return (
    <fieldset className="wx-choice">
      <legend>{label}</legend>
      <div className="wx-choice-row">
        {options.map(([v, name]) => (
          <button key={String(v)} type="button" className={`wx-btn${value === v ? ' wx-btn-primary' : ''}`} aria-pressed={value === v} onClick={() => onChange(v)}>
            {value === v && <Icon name="check" size={20} />}<span>{name}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function SettingsDialog({ settings, onChange, onClose }: { settings: WxSettings; onChange: (s: WxSettings) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const items = [...ref.current.querySelectorAll<HTMLElement>('button')];
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('keydown', key); before?.focus(); };
  }, [onClose]);
  const set = <K extends keyof WxSettings>(k: K) => (v: WxSettings[K]) => onChange({ ...settings, [k]: v });
  return (
    <div className="wx-dialog-back" onClick={onClose}>
      <div ref={ref} className="wx-dialog" role="dialog" aria-modal="true" aria-labelledby="wx-settings-title" onClick={(e) => e.stopPropagation()}>
        <div className="wx-dialog-head">
          <h2 id="wx-settings-title" className="wx-h1">Settings</h2>
          <button type="button" className="wx-btn" onClick={onClose}><Icon name="close" size={22} /><span>Close</span></button>
        </div>
        <Choice label="Colors" value={settings.theme} options={[['light', 'Light'], ['dark', 'Dark'], ['contrast', 'High contrast']]} onChange={set('theme')} />
        <Choice label="Text size" value={settings.textSize} options={[['medium', 'Medium'], ['large', 'Large'], ['xl', 'Extra large']]} onChange={set('textSize')} />
        <Choice label="Reading speed" value={settings.speed} options={[[0.7, 'Slower'], [0.9, 'Normal'], [1.1, 'Faster']]} onChange={set('speed')} />
        <Choice label="Say button names when I tap them" value={settings.sayButtons} options={[[true, 'On'], [false, 'Off']]} onChange={set('sayButtons')} />
        <Choice label="Teacher view (shows drafts, review buttons and sources)" value={settings.teacherView} options={[[false, 'Off'], [true, 'On']]} onChange={set('teacherView')} />
      </div>
    </div>
  );
}
