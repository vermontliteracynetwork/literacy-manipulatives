import { Icon } from './Icon';

// Every tool's way back to the Literacy Manipulatives dashboard (her request 2026-11-12).
export function HomeButton({ className = 'btn btn-sm' }: { className?: string }) {
  return (
    <a className={`lm-home-btn ${className}`} href="/" aria-label="Home: all Literacy Manipulatives tools">
      <Icon name="home" size={20} /><span>Home</span>
    </a>
  );
}
