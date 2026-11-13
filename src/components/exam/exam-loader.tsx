/** Full-screen "getting your exam ready" screen, shared by the Start button and the exam page. */
export function ExamLoader({ title, resume }: { title?: string; resume?: boolean }) {
  const steps = resume ? ["Restoring your answers", "Syncing the timer", "Opening your exam"] : ["Shuffling in the questions", "Starting your timer", "Opening the exam room"];
  return (
    <div role="status" aria-live="polite" className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/70 p-6 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[28px] bg-white p-8 text-center shadow-2xl">
        <div className="relative mx-auto h-20 w-20">
          <svg viewBox="0 0 80 80" className="h-20 w-20 animate-spin [animation-duration:1.1s]" aria-hidden>
            <circle cx="40" cy="40" r="34" fill="none" stroke="#ECF0F8" strokeWidth="8" />
            <circle cx="40" cy="40" r="34" fill="none" stroke="#1559ED" strokeWidth="8" strokeLinecap="round" strokeDasharray="70 214" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-mark-500 text-sm font-extrabold tracking-tight text-white">16</span>
          </span>
        </div>
        <p className="mt-6 font-display text-2xl text-ink-950">{resume ? "Welcome back!" : "Get ready…"}</p>
        {title ? <p className="mt-1 text-sm text-ink-500">{title}</p> : null}
        <ul className="mt-6 space-y-2.5 text-left text-sm">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-3 opacity-0 [animation:loaderStep_.5s_ease-out_forwards]" style={{ animationDelay: `${i * 0.7}s` }}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-50 text-xs font-bold text-success-700">✓</span>
              <span className="text-ink-700">{s}</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-ink-400">Tip: find a quiet spot. The timer is just like the real exam.</p>
      </div>
    </div>
  );
}
