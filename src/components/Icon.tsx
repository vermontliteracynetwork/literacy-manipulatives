// Small line icons used where a button has no words (her request 2026-10-15: no emojis anywhere on the board).
type IconName = 'speaker' | 'speaking' | 'eye' | 'pencil' | 'dice' | 'gear' | 'arrow' | 'finger' | 'trash' | 'copy';

const PATHS: Record<IconName, React.ReactNode> = {
  speaker: <><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16 9.5a3.5 3.5 0 0 1 0 5" /></>,
  speaking: <><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16 9.5a3.5 3.5 0 0 1 0 5" /><path d="M18.5 7a7 7 0 0 1 0 10" /></>,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  pencil: <><path d="M4 20l1-4L16 5l3 3L8 19l-4 1z" /><path d="M14 7l3 3" /></>,
  arrow: <path d="M5 3.5L19.5 9.8c.9.4.8 1.7-.2 1.9l-5.6 1.3-1.5 6.6c-.2 1-1.6 1.1-1.9.2L4.1 4.6c-.3-.7.3-1.4.9-1.1z" fill="currentColor" />,
  finger: <g fill="currentColor"><rect x="9" y="1.5" width="4" height="13" rx="2" /><rect x="12.6" y="8" width="3.6" height="8" rx="1.8" /><rect x="15.8" y="9" width="3.4" height="7.5" rx="1.7" /><rect x="4.2" y="10.5" width="3.6" height="7.5" rx="1.8" transform="rotate(-38 6 14.2)" /><path d="M8.2 13h11v4.2c0 3.2-2.3 5.3-5.3 5.3h-1.4c-2.6 0-4.3-1.5-4.3-4.3z" /></g>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" /><path d="M14 11v6M11 14h6" /></>,
  trash: <><path d="M4 7h16" /><path d="M9 7V4.5h6V7" /><path d="M6.5 7l1 13h9l1-13" /><path d="M10 11v6M14 11v6" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" /><circle cx="12" cy="12" r="6.5" /></>,
  dice: <><rect x="4" y="4" width="16" height="16" rx="3" /><circle cx="9" cy="9" r="1.2" fill="currentColor" /><circle cx="15" cy="15" r="1.2" fill="currentColor" /><circle cx="15" cy="9" r="1.2" fill="currentColor" /><circle cx="9" cy="15" r="1.2" fill="currentColor" /></>,
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'block' }}>
      {PATHS[name]}
    </svg>
  );
}
