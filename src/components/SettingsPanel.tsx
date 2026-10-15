import { FONT_OPTIONS, type FontChoice } from '../lib/fontChoice';

export function SettingsPanel({ font, onFont, onClose }: { font: FontChoice; onFont: (f: FontChoice) => void; onClose: () => void }) {
  return (
    <div className="lm-settings" role="dialog" aria-label="Settings">
      <div className="lm-settings-bar">
        <span>Settings</span>
        <button className="lm-float-x" onClick={onClose} aria-label="Close settings">×</button>
      </div>
      <div className="lm-settings-body">
        <strong>Font for the whole board</strong>
        {FONT_OPTIONS.map((o) => (
          <button key={o.id} type="button" className={`lm-font-choice${font === o.id ? ' on' : ''}`} aria-pressed={font === o.id} onClick={() => onFont(o.id)}>
            <span className="name">{o.name}{o.id === 'inclusive' ? ' (default)' : ''}</span>
            <span className="sample" style={{ fontFamily: o.family }}>The cat sat. Aa Bb Cc</span>
          </button>
        ))}
      </div>
    </div>
  );
}
