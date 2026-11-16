"use client";

import { useEffect, useState } from "react";

/** Live "1:12:05 left" countdown for an exam in progress. */
export function TimeLeft({ deadline, serverNow }: { deadline: string; serverNow: number }) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const skew = serverNow - Date.now();
    const t = setInterval(() => setNow(Date.now() + skew), 1000);
    return () => clearInterval(t);
  }, [serverNow]);
  const ms = Math.max(0, Date.parse(deadline) - now);
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return (
    <span className="tabular">
      {ms === 0 ? "Time's up" : `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(sec).padStart(2, "0")} left`}
    </span>
  );
}
