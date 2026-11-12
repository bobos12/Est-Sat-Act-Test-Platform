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

function ExamCard({ e }: { e: ShelfExam }) {
  const S = SUBJECTS[e.subject];
  const [cta, note] = e.access === "free" ? ["Start free exam", "Free account"] : ["Unlock with Pro", "Subscription"];
  return (
    <a className={`exam${e.access === "free" ? " free-x" : ""}`} href={examHref(e)}>
      <div className="exam-top">
        <span className="subj" style={css({ "--c": S.color })}><i />{S.label}</span>
        <span className={`access ${e.access}`}>{e.access === "free" ? "FREE" : "PRO"}</span>
      </div>
      <h3>{e.title}</h3>
      <div className="kind">{e.kind}{e.live && <> · <span className="live">● Live now</span></>}</div>
      <Sheet e={e} />
      <div className="meta">
        <span><Bubbles />{e.questions} QUESTIONS</span>
        <span><Clock />{e.minutes} MIN</span>
        {e.modules.length > 1 && <span>{e.modules.length} MODULES</span>}
      </div>
      <div className="exam-cta">
        <span className="go">{cta} <Arrow /></span>
        <span className="tiny">{note}</span>
      </div>
    </a>
  );
}

export function ExamShelf({ exams }: { exams: ShelfExam[] }) {
  const [k, setK] = useState("all");
  const F = FILTERS.find((f) => f.k === k)!;
  const open = useMemo(() => exams.filter((e) => e.access !== "soon" && F.f(e)), [exams, F]);
  const soon = useMemo(() => exams.filter((e) => e.access === "soon" && F.f(e)), [exams, F]);

  return (
    <>
      <div className="filters" role="toolbar" aria-label="Filter exams">
        {FILTERS.map((f) => (
          <button key={f.k} className="chip" aria-pressed={k === f.k} onClick={() => setK(f.k)}>
            <i />{f.label}<span className="ct">{exams.filter(f.f).length}</span>
          </button>
        ))}
      </div>
      {open.length > 0 && <div className="shelf">{open.map((e) => <ExamCard key={e.id} e={e} />)}</div>}
      {soon.length > 0 && (
        <div className="soon-row">
          <span className="lab">EST II, coming soon:</span>
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
