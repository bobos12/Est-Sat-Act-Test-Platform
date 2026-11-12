"use client";
import { useEffect, useState } from "react";

/** Interactive mock of the exam room (Literacy, split pane). Purely illustrative. */
export function EngineDemo() {
  const [sel, setSel] = useState<number | null>(null);
  const [flag, setFlag] = useState(false);
  const [s, setS] = useState(89 * 60 + 59);
  useEffect(() => { const id = setInterval(() => setS((x) => Math.max(0, x - 1)), 1000); return () => clearInterval(id); }, []);

  return (
    <div className="app">
      <div className="app-bar">
        <span>EST I · LITERACY · MODULE 1</span>
        <span className="t">
          <button className={`flag${flag ? " on" : ""}`} onClick={() => setFlag(!flag)}>⚑ Flag</button>
          <span className="clock">{Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}</span>
        </span>
      </div>
      <div className="app-main">
        <div className="app-pass">
          <h5>Passage 1 · Analysis in Science</h5>
          Coral reefs cover less than one percent of the ocean floor, <mark><sup>4</sup>yet support</mark> roughly a quarter of all
          marine species. Scientists have long <mark className="act"><sup>5</sup>wandered</mark> how such a small area sustains so
          much life. The answer lies in a partnership between coral and the algae <mark><sup>6</sup>who</mark> live
          inside its tissue.
        </div>
        <div className="app-q">
          <span className="ql">QUESTION 5 OF 35</span>
          <p>Which choice best fits the context of the passage?</p>
          {["NO CHANGE", "wondered", "wondering", "had wandered"].map((o, i) => (
            <div key={o} className={`app-opt${sel === i ? " sel" : ""}`} onClick={() => setSel(i)}><i>{"ABCD"[i]}</i>{o}</div>
          ))}
        </div>
      </div>
      <div className="app-nav">
        {Array.from({ length: 35 }, (_, k) => {
          const n = k + 1;
          const cls = n < 5 ? "a" : n === 5 ? "c" : n === 9 ? "f" : "";
          return <b key={n} className={cls}>{n}</b>;
        })}
        <span className="save">SAVED</span>
      </div>
    </div>
  );
}
