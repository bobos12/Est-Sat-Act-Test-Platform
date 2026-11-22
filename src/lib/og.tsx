import { ImageResponse } from "next/og";

export const ogSize = { width: 1200, height: 630 };

/** 1200×630 share card: logo, headline, supporting line. Default font only (no network fetch at build). */
export function ogCard({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "72px 80px", background: "#0A0F1C", color: "#fff", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="64" height="64" viewBox="0 0 32 32">
            <circle cx="14" cy="18" r="11" fill="none" stroke="#6AA4FF" strokeWidth="3" />
            <circle cx="14" cy="18" r="4.25" fill="#6AA4FF" />
            <path d="M14 18 26.5 5.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M23.2 3.6v5.2h5.2" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 700, letterSpacing: -1.5 }}>
            Target<span style={{ color: "#6AA4FF" }}>Score</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", fontSize: 26, letterSpacing: 3, textTransform: "uppercase", color: "#6AA4FF" }}>{eyebrow}</div>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, lineHeight: 1.04, letterSpacing: -2.5, maxWidth: 1000 }}>{title}</div>
          <div style={{ display: "flex", fontSize: 32, color: "#C8D1E2", maxWidth: 980, lineHeight: 1.35 }}>{subtitle}</div>
        </div>
        <div style={{ display: "flex", height: 8, width: 160, background: "#1559ED", borderRadius: 4 }} />
      </div>
    ),
    ogSize,
  );
}
