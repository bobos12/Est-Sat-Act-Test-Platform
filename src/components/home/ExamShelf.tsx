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

export function ExamShelf({ exams }: { exams: ShelfExam[] }) {
  const [k, setK] = useState("all");
  const F = FILTERS.find((f) => f.k === k)!;
  const open = useMemo(() => exams.filter((e) => e.access !== "soon" && F.f(e)), [exams, F]);
  const soon = useMemo(() => exams.filter((e) => e.access === "soon" && F.f(e)), [exams, F]);
  const locked = open.filter((e) => e.access === "pro").length;

  return (
    <>
      <div className="filters" role="toolbar" aria-label="Filter exams">
        {FILTERS.map((f) => (
          <button key={f.k} className="chip" aria-pressed={k === f.k} onClick={() => setK(f.k)}>
            <i />{f.label}<span className="ct">{exams.filter(f.f).length}</span>
          </button>
        ))}
      </div>
      {open.length > 1 && <p className="swipe-hint" aria-hidden="true">Swipe to see more →</p>}
      {open.length > 0 && <div className="shelf">{open.map((e) => <ExamCard key={e.id} e={e} />)}</div>}
      {locked > 0 && (
        <a href="#pricing" className="unlock-strip">
          <span className="lock-ic"><Lock s={18} /></span>
          <span className="txt"><b>{locked} full {locked === 1 ? "exam is" : "exams are"} waiting for you.</b> Unlock every EST, SAT and ACT mock with one membership.</span>
          <span className="btn btn-blue btn-sm">See plans <Arrow /></span>
        </a>
      )}
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
