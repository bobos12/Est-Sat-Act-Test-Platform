export const Arrow = ({ s = 15 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Clock = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <circle cx="8" cy="9" r="5.5" /><path d="M8 6v3l2 1.5" />
  </svg>
);

export const Bubbles = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <circle cx="5" cy="5" r="2.5" /><circle cx="11" cy="5" r="2.5" /><circle cx="5" cy="11" r="2.5" />
    <circle cx="11" cy="11" r="2.5" fill="currentColor" />
  </svg>
);

export const Check = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="7" fill="currentColor" />
    <path d="M4.8 8.2l2.1 2 4.3-4.4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
