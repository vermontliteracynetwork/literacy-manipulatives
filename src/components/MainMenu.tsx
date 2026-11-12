import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

// The one floating button on a screen (her rule): the Literacy Manipulatives main menu, bottom right.
// Screens leave room for it (bottom padding) so it never covers a control.
const LINKS = [
  { href: '/', label: 'All tools' },
  { href: '/words', label: 'Word Explorer' },
  { href: '/formulas', label: 'Formula Search' },
  { href: '/write', label: 'Word Processor' },
  { href: '/whiteboard?welcome=0', label: 'Whiteboard' },
];

export function MainMenu() {
  const [open, setOpen] = useState(false);
  const first = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);
  return (
    <div className="lm-mainmenu">
      {open && (
        <nav className="lm-mainmenu-sheet" id="lm-mainmenu-sheet" aria-label="Main menu">
          <ul>{LINKS.map((l, i) => <li key={l.href}><a ref={i === 0 ? first : undefined} href={l.href}>{l.label}</a></li>)}</ul>
        </nav>
      )}
      <button type="button" className="lm-mainmenu-btn" aria-expanded={open} aria-controls="lm-mainmenu-sheet" onClick={() => setOpen((o) => !o)}>
        <Icon name={open ? 'close' : 'menu'} size={26} /><span>Menu</span>
      </button>
    </div>
  );
}
