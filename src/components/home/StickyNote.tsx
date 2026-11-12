/** Decorative handwritten sticky note. Purely visual, hidden from screen readers. */
const COLORS = {
  yellow: "#FFE88A",
  pink: "#FFC6D6",
  blue: "#C4E2FF",
  green: "#CBF1C4",
  orange: "#FFD5A8",
} as const;

export function StickyNote({
  color = "yellow",
  rotate = -3,
  className = "",
  doodle,
  children,
}: {
  color?: keyof typeof COLORS;
  rotate?: number;
  className?: string;
  doodle?: "arrow" | "star" | "check" | "underline" | "heart";
  children: React.ReactNode;
}) {
  return (
    <div className={`note ${className}`} style={{ "--nc": COLORS[color], "--r": `${rotate}deg` } as React.CSSProperties} aria-hidden="true">
      <span className="note-txt">{children}</span>
      {doodle ? <Doodle kind={doodle} /> : null}
    </div>
  );
}

function Doodle({ kind }: { kind: NonNullable<Parameters<typeof StickyNote>[0]["doodle"]> }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (kind) {
    case "arrow":
      return (
        <svg className="note-doodle" viewBox="0 0 80 40" width="70" height="35">
          <path {...common} d="M4 30 C 22 8, 46 6, 70 16" />
          <path {...common} d="M60 8 L71 16 L60 24" />
        </svg>
      );
    case "star":
      return (
        <svg className="note-doodle" viewBox="0 0 40 40" width="34" height="34">
          <path {...common} d="M20 4 L24 15 L36 15 L26 22 L30 34 L20 27 L10 34 L14 22 L4 15 L16 15 Z" />
        </svg>
      );
    case "check":
      return (
        <svg className="note-doodle" viewBox="0 0 40 30" width="40" height="30">
          <path {...common} d="M4 16 L14 26 L36 4" />
        </svg>
      );
    case "heart":
      return (
        <svg className="note-doodle" viewBox="0 0 40 36" width="34" height="30">
          <path {...common} d="M20 32 C 6 22, 2 14, 6 8 C 10 2, 18 4, 20 10 C 22 4, 30 2, 34 8 C 38 14, 34 22, 20 32 Z" />
        </svg>
      );
    default:
      return (
        <svg className="note-doodle note-under" viewBox="0 0 140 14" width="130" height="12">
          <path {...common} d="M3 9 C 30 3, 60 12, 90 6 S 130 5, 137 8" />
        </svg>
      );
  }
}
