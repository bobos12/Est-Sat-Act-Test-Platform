"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Arrow } from "./Icons";
import { FREE_START_HREF } from "@/lib/exam-catalog";

const M = ({ children }: { children: ReactNode }) => <span className="m">{children}</span>;

/** Three original EST-style warm-up questions (not taken from official papers). */
const QUESTIONS: { subj: string; color: string; label: string; stem: ReactNode; opts: ReactNode[]; answer: number; why: ReactNode }[] = [
  {
    subj: "EST I · Math", color: "#6AA4FF", label: "Foundational Algebra",
    stem: <>If <M>3(x − 2) = 2x + 5</M>, what is the value of <M>x</M>?</>,
    opts: ["3", "7", "11", "13"], answer: 2,
    why: <><b>11.</b> Expand to 3x − 6 = 2x + 5, then subtract 2x and add 6.</>,
  },
  {
    subj: "EST I · Literacy", color: "#fff", label: "Standard English Conventions",
    stem: <><span className="passage">The researchers&apos; findings, which were published last spring, <u>has changed</u> how cities plan for flooding.</span>Which choice completes the sentence correctly?</>,
    opts: ["NO CHANGE", "have changed", "having changed", "is changing"], answer: 1,
    why: <><b>have changed.</b> The subject is “findings”, which is plural. The clause in the middle doesn&apos;t change that.</>,
  },
  {
    subj: "EST I · Math", color: "#6AA4FF", label: "Data Analysis and Probability",
    stem: <>A bag holds 4 red and 6 blue marbles. One marble is drawn at random. What is the probability that it is red?</>,
    opts: [<M key="a">2/5</M>, <M key="b">3/5</M>, <M key="c">2/3</M>, <M key="d">1/4</M>], answer: 0,
    why: <><b>2/5.</b> 4 red out of 10 marbles in total is 4/10, which simplifies to 2/5.</>,
  },
];

export function TryQuestion() {
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [t, setT] = useState(90);

  useEffect(() => {
    const id = setInterval(() => setT((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  const done = qi >= QUESTIONS.length;
  const Q = QUESTIONS[Math.min(qi, QUESTIONS.length - 1)];
  const score = results.filter(Boolean).length;

  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    setTimeout(() => { setRevealed(true); setResults((r) => [...r, i === Q.answer]); }, 380);
  };
  const next = () => { setQi((q) => q + 1); setPicked(null); setRevealed(false); };
  const reset = () => { setQi(0); setPicked(null); setRevealed(false); setResults([]); setT(90); };

  return (
    <div className="try">
        <div className="card-q" role="group" aria-label="Try a sample question">
          <div className="q-top">
            <span className="tag" style={{ ["--c" as string]: Q.color }}><i /><span>{Q.subj}</span></span>
            <span className="timer">{`0${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`}</span>
          </div>
          <div className="q-prog">
            {QUESTIONS.map((_, i) => (
              <span key={i} className={i < results.length ? (results[i] ? "ok" : "no") : i <= qi ? "on" : ""} />
            ))}
          </div>
          <div className="q-body">
            {done ? (
              <div className="done">
                <div className="eyebrow">Warm-up complete</div>
                <div className="big">{score}/3</div>
                <p>{score === 3 ? "A perfect warm-up. That's the 1600 mindset." : "Good start. Now you know what to practise."} The full EST I Math mock is 50 questions in 75 minutes, and your first one is free.</p>
                <a className="btn btn-blue" href={FREE_START_HREF}>Start a free exam <Arrow /></a>
                <div style={{ marginTop: 14 }}><button className="link" onClick={reset}>Try again</button></div>
              </div>
            ) : (
              <>
                <div className="q-label">Question {qi + 1} of 3 · {Q.label}</div>
                <div className="q-stem">{Q.stem}</div>
                <div className="opts">
                  {Q.opts.map((o, i) => {
                    const cls = ["opt",
                      picked === i && "picked",
                      revealed && i === Q.answer && "right",
                      revealed && picked === i && i !== Q.answer && "wrong"].filter(Boolean).join(" ");
                    return (
                      <button key={i} className={cls} disabled={picked !== null} onClick={() => pick(i)}>
                        <span className="bub"><b>{"ABCD"[i]}</b></span><span>{o}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="q-foot">
                  <div className={`explain${revealed ? " show" : ""}`}>{revealed && Q.why}</div>
                  <button className={`btn btn-ink btn-sm${revealed ? " show" : ""}`} onClick={next}>
                    {qi < 2 ? "Next" : "See score"} <Arrow />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      <div className="try-note">
        <span>Try three real-format questions. No sign-up needed.</span>
        <span className="score-chip">SCORE <b>{score}/3</b></span>
      </div>
    </div>
  );
}
