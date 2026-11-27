"use client";
import { useMemo, useState } from "react";
import { SUBJECTS, TRACK_OF, examHref, type ShelfExam } from "@/lib/exam-catalog";
import { Arrow, Bubbles, Clock } from "./Icons";

const FILTERS: { k: string; label: string; f: (e: ShelfExam) => boolean }[] = [
  { k: "all", label: "All exams", f: () => true },
  { k: "free", label: "Free", f: (e) => e.access === "free" },
  { k: "math", label: "EST I Math", f: (e) => e.subject === "math" },
  { k: "lit", label: "EST I Literacy", f: (e) => e.subject === "lit" },
  { k: "est2", label: "EST II", f: (e) => ["m1", "m2", "bio", "chem"].includes(e.subject) },
  { k: "sat", label: "SAT", f: (e) => TRACK_OF[e.subject] === "sat" },
  { k: "act", label: "ACT", f: (e) => TRACK_OF[e.subject] === "act" },
];

const css = (vars: Record<string, string | number>) => vars as React.CSSProperties;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
/** Official EST session papers are titled like "EST I Math: January 2026" or "EST I Literacy: Sample". */
const OFFICIAL = /^EST (I|II)\b.*:\s*(sample|[a-z]+ \d{4})$/i;

/** Newer sessions first; the Sample paper after the dated ones. */
function sessionRank(title: string) {
  const m = /:\s*([a-z]+) (\d{4})$/i.exec(title);
  if (!m) return 0;
  const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
  return Number(m[2]) * 12 + (month < 0 ? 0 : month);
}

/**
 * Homepage order: the original EST I papers first, alternating Math and Literacy (newest session first),
 * then EST II papers, other EST exams, SAT/ACT, and AI practice sets last.
 */
function featuredOrder(list: ShelfExam[]) {
  const group = (e: ShelfExam) =>
    e.kind === "Practice set" ? 5 : OFFICIAL.test(e.title) ? (e.subject === "math" || e.subject === "lit" ? 0 : 1) : TRACK_OF[e.subject] === "est" ? 2 : 3;
  const sorted = [...list].sort((a, b) => group(a) - group(b) || sessionRank(b.title) - sessionRank(a.title));
  // Interleave Math and Literacy inside the first group so both show in the first rows.
  const first = sorted.filter((e) => group(e) === 0);
  const math = first.filter((e) => e.subject === "math");
  const lit = first.filter((e) => e.subject === "lit");
  const mixed: ShelfExam[] = [];
  for (let i = 0; i < Math.max(math.length, lit.length); i++) {
    if (math[i]) mixed.push(math[i]);
    if (lit[i]) mixed.push(lit[i]);
  }
  return [...mixed, ...sorted.filter((e) => group(e) !== 0)];
}

function Sheet({ e }: { e: ShelfExam }) {
  const S = SUBJECTS[e.subject];
  const shades = S.shades ?? [S.color];
  const cols = e.questions >= 60 ? 30 : 25;
  let i = 0;
  return (
    <div className="sheet" style={css({ "--cols": cols })} aria-hidden="true">
      {e.modules.flatMap((n, mi) =>
        Array.from({ length: n }, () => (
          <s key={i} className={e.modules.length > 1 ? "mod" : ""} style={css({ "--i": i++, "--c": shades[mi % shades.length] })} />
        )),
      )}
    </div>
  );
}

const Lock = ({ s = 14 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V7.5a4 4 0 018 0v3" />
  </svg>
);

function ExamCard({ e }: { e: ShelfExam }) {
  const S = SUBJECTS[e.subject];
  const free = e.access === "free";
  return (
    <a className={`exam ${free ? "free-x" : "locked"}`} href={examHref(e)}>
      {free ? <span className="free-ribbon">FREE · NO CARD</span> : null}
      <div className="exam-top">
        <span className="subj" style={css({ "--c": S.color })}><i />{S.label}</span>
        {free ? <span className="access free">FREE</span> : <span className="access pro"><Lock s={11} /> PRO</span>}
      </div>
      <h3>{e.title}</h3>
      <div className="kind">{e.kind}{e.live && <> · <span className="live">● Live now</span></>}</div>
      {free ? (
        <Sheet e={e} />
      ) : (
        <div className="lockwrap">
          <Sheet e={e} />
          <div className="lock-over">
            <span className="lock-ic"><Lock s={18} /></span>
            <span>Members only</span>
          </div>
        </div>
      )}
      <div className="meta">
        <span><Bubbles />{e.questions} QUESTIONS</span>
        <span><Clock />{e.minutes} MIN</span>
        {e.modules.length > 1 && <span>{e.modules.length} MODULES</span>}
      </div>
      <div className="exam-cta">
        {free ? (
          <>
            <span className="go-btn free">Start free exam <Arrow /></span>
            <span className="tiny">Free account</span>
          </>
        ) : (
          <>
            <span className="go-btn pro"><Lock s={14} /> Unlock with Pro</span>
            <span className="tiny">from 192 EGP/mo</span>
          </>
        )}
      </div>
    </a>
  );
}

/** Two rows of cards on the homepage; the rest open with "Show all". */
const SHOWN = 6;

export function ExamShelf({ exams }: { exams: ShelfExam[] }) {
  const [k, setK] = useState("all");
  const [all, setAll] = useState(false);
  const F = FILTERS.find((f) => f.k === k)!;
  const open = useMemo(() => featuredOrder(exams.filter((e) => e.access !== "soon" && F.f(e))), [exams, F]);
  const soon = useMemo(() => exams.filter((e) => e.access === "soon" && F.f(e)), [exams, F]);

  return (
    <>
      <div className="filters" role="toolbar" aria-label="Filter exams">
        {FILTERS.map((f) => (
          <button key={f.k} className="chip" aria-pressed={k === f.k} onClick={() => { setK(f.k); setAll(false); }}>
            <i />{f.label}<span className="ct">{exams.filter(f.f).length}</span>
          </button>
        ))}
      </div>
      {open.length > 1 && <p className="swipe-hint" aria-hidden="true">Swipe to see more →</p>}
      {open.length > 0 && (
        <div className={`shelf-box${!all && open.length > SHOWN ? " clipped" : ""}`}>
          <div className="shelf">{(all ? open : open.slice(0, SHOWN)).map((e) => <ExamCard key={e.id} e={e} />)}</div>
        </div>
      )}
      {open.length > SHOWN ? (
        <div className="shelf-more">
          {all ? (
            <button type="button" className="btn btn-line" onClick={() => setAll(false)} aria-expanded>
              Show fewer
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-blue more-btn" onClick={() => setAll(true)} aria-expanded={false}>
                <span className="more-count">+{open.length - SHOWN}</span> Show all {open.length} exams
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              <p className="more-sub">
                {[...new Set(open.slice(SHOWN).map((e) => SUBJECTS[e.subject].label.split(" · ")[0]))].join(" · ")} and more, ready to start
              </p>
            </>
          )}
        </div>
      ) : null}
      {soon.length > 0 && (
        <div className="soon-row">
          <span className="lab">Coming soon:</span>
          {soon.map((e) => (
            <span key={e.id} className="soon-pill" style={css({ "--c": SUBJECTS[e.subject].color })}>
              <i />{e.title.replace("EST II ", "")}<small>{e.questions} Q · {e.minutes} MIN</small>
            </span>
          ))}
          <span className="access soon">SOON</span>
        </div>
      )}
    </>
  );
}
