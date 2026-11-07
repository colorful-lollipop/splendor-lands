import type { SVGProps } from 'react';

const paths: Record<string, JSX.Element> = {
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h9" />
    </>
  ),
  crown: (
    <>
      <path d="M4 8l4 4 4-7 4 7 4-4v10H4z" />
      <path d="M4 21h16" />
    </>
  ),
  chat: (
    <>
      <path d="M21 12a8 8 0 0 1-8 8H7l-3 2 1-4a8 8 0 1 1 16-6z" />
      <path d="M8 11h8M8 15h5" />
    </>
  ),
  scroll: (
    <>
      <path d="M6 4h11a2 2 0 0 1 2 2v14H8a2 2 0 0 0-2 2z" />
      <path d="M6 4a2 2 0 0 0-2 2v1h4M9 9h6M9 13h6M9 17h4" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3a9 9 0 1 0 0 18c1.7 0 2-1.1 1.3-2-.8-1.1-.2-2.4 1.2-2.4H17a4 4 0 0 0 4-4c0-5.2-4-9.6-9-9.6z" />
      <circle cx="7.6" cy="11" r="1" fill="currentColor" stroke="none" />
      <circle cx="10" cy="7.4" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.6" cy="7.4" r="1" fill="currentColor" stroke="none" />
      <circle cx="17" cy="11" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  sound: (
    <>
      <path d="M4 10v4h3l4 3V7L7 10z" />
      <path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  mute: (
    <>
      <path d="M4 10v4h3l4 3V7L7 10z" />
      <path d="M15 9l4 6M19 9l-4 6" />
    </>
  ),
  leave: (
    <>
      <path d="M10 4H5v16h5" />
      <path d="M14 8l4 4-4 4M9 12h9" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="M4 12.5l5 5L20 6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 5.5a3 3 0 0 1 0 5.8M17.5 14.2A5.5 5.5 0 0 1 21 19.5" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M18.5 16l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  book: (
    <>
      <path d="M4 5a2 2 0 0 1 2-2h6v17H6a2 2 0 0 0-2 2z" />
      <path d="M20 5a2 2 0 0 0-2-2h-6v17h6a2 2 0 0 1 2 2z" />
    </>
  ),
  collection: (
    <>
      <rect x="3" y="4" width="13" height="17" rx="2" />
      <path d="M7 2h13a1 1 0 0 1 1 1v15M7 8h5M7 12h5M7 16h3" />
      <path d="M18 17l1.2 2.3 2.5.4-1.8 1.8.4 2.5-2.3-1.2-2.2 1.2.4-2.5-1.8-1.8 2.5-.4z" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  gem: (
    <>
      <path d="M7 3h10l4 6-9 12L3 9z" />
      <path d="M3 9h18M7 3l2 6 3 12M17 3l-2 6-3 12" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
    </>
  ),
  music: (
    <>
      <path d="M9 17V5l10-2v12" />
      <circle cx="6.5" cy="17.5" r="2.5" />
      <circle cx="16.5" cy="15.5" r="2.5" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 19h2" />
    </>
  ),
  rotate: (
    <>
      <path d="M4 7a9 9 0 0 1 15-2l2 2" />
      <path d="M21 3v5h-5" />
      <path d="M20 17a9 9 0 0 1-15 2l-2-2" />
      <path d="M3 21v-5h5" />
    </>
  ),
};

export function Icon({ name, size = 18, ...rest }: { name: keyof typeof paths | string; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {paths[name] || paths.gem}
    </svg>
  );
}

export function CornerFlourish({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 44 44" className={`corner-flourish ${className}`} aria-hidden="true">
      <path d="M3 41C3 21 21 3 41 3" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9 41C9 23.3 23.3 9 41 9" fill="none" stroke="currentColor" strokeWidth="0.7" opacity="0.65" />
      <path d="M3 34c0-2.5 2-4.5 4.5-4.5S12 31.5 12 34" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.7" />
      <circle cx="41" cy="3" r="1.2" fill="currentColor" opacity="0.8" />
    </svg>
  );
}

export function CardBack({ className = '', label }: { className?: string; label?: string }) {
  const skin = typeof document !== 'undefined' ? document.documentElement.dataset.back || 'emerald' : 'emerald';
  return (
    <div className={`card-back ${className}`} data-back={skin}>
      <img src={`/assets/art/back-${skin}.webp`} alt="" draggable={false} />
      {label && <span className="card-back-label">{label}</span>}
    </div>
  );
}

export function PatternDivider() {
  return (
    <div className="pattern-divider" aria-hidden="true">
      <span className="pd-line" />
      <span className="pd-gem">◆</span>
      <span className="pd-line" />
    </div>
  );
}