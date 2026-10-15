// Small line icons used where a button has no words (her request 2026-10-15: no emojis anywhere on the board).
type IconName = 'speaker' | 'speaking' | 'eye' | 'pencil' | 'dice';

const PATHS: Record<IconName, React.ReactNode> = {
  speaker: <><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16 9.5a3.5 3.5 0 0 1 0 5" /></>,
  speaking: <><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16 9.5a3.5 3.5 0 0 1 0 5" /><path d="M18.5 7a7 7 0 0 1 0 10" /></>,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  pencil: <><path d="M4 20l1-4L16 5l3 3L8 19l-4 1z" /><path d="M14 7l3 3" /></>,
  dice: <><rect x="4" y="4" width="16" height="16" rx="3" /><circle cx="9" cy="9" r="1.2" fill="currentColor" /><circle cx="15" cy="15" r="1.2" fill="currentColor" /><circle cx="15" cy="9" r="1.2" fill="currentColor" /><circle cx="9" cy="15" r="1.2" fill="currentColor" /></>,
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'block' }}>
      {PATHS[name]}
    </svg>
  );
}
