import type { CSSProperties, ReactNode } from 'react';
import type { TTSSettings } from '../types';
import { SyncedSpeakButton, type SyncedTTS } from './SyncedSpeakButton';

// One shared "here's a small reference fact about this thing" component,
// ported as-is from the dashboard's components/ReferencePopover.tsx —
// a hover tooltip (Grammar Symbols, Symbol Sentence previews) and an
// always-visible inline card (Morpheme definitions) sharing one layout.
export function ReferencePopover({ mode, title, body, children, speakId, speakText, tts, settings, style }: {
  mode: 'hover' | 'inline';
  title?: string;
  body: ReactNode;
  children?: ReactNode;
  speakId?: string;
  speakText?: string;
  tts?: SyncedTTS;
  settings?: TTSSettings;
  style?: CSSProperties;
}) {
  if (mode === 'hover') {
    return (
      <div className="lm-symbol-tip-wrap" tabIndex={-1}>
        {children}
        <div className="lm-symbol-tip" role="tooltip">
          {title && <strong>{title}</strong>}
          {body}
        </div>
      </div>
    );
  }
  return (
    <div className="chrome-frame lm-ref-popover" style={style}>
      <div className="space-between" style={{ alignItems: 'center', marginBottom: title ? 2 : 0 }}>
        {title && <div style={{ fontWeight: 800 }}>{title}</div>}
        {speakText && tts && speakId && (
          <SyncedSpeakButton
            id={speakId}
            text={speakText}
            tts={tts}
            settings={settings}
            ariaLabel={title ? `Hear ${title}` : 'Hear this'}
            style={{ padding: '2px 8px', minHeight: 24 }}
          />
        )}
      </div>
      <div>{body}</div>
    </div>
  );
}
