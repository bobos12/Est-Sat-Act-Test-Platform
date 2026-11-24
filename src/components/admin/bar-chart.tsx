/** Daily bar chart (single series). Hover a column for its exact value. */
export function DailyBars({ data, unit }: { data: { label: string; value: number }[]; unit: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <figure>
      <div className="flex h-32 items-end gap-[2px]" role="img" aria-label={`${total} ${unit} over ${data.length} days`}>
        {data.map((d, i) => (
          <div key={i} className="group relative flex h-full flex-1 items-end justify-center">
            <div
              className="w-full max-w-5 rounded-t-[4px] bg-mark-500 transition-colors group-hover:bg-mark-700"
              style={{ height: d.value ? `${Math.max(4, (d.value / max) * 100)}%` : "2px", opacity: d.value ? 1 : 0.25 }}
            />
            <div className="pointer-events-none absolute bottom-full z-10 mb-1.5 hidden whitespace-nowrap rounded-md bg-ink-950 px-2 py-1 text-xs text-white shadow-lg group-hover:block">
              <b className="tabular">{d.value}</b> {unit} · {d.label}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between border-t border-line pt-1.5 text-[0.6875rem] text-ink-500">
        <span>{data[0]?.label}</span>
        <span>{data.at(-1)?.label}</span>
      </div>
    </figure>
  );
}

/** Bucket ISO timestamps into the last `days` Cairo calendar days (oldest first). */
export function bucketDays(isoDates: string[], now: number, days = 14) {
  const fmtKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" });
  const fmtLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Cairo" });
  const counts = new Map<string, number>();
  for (const iso of isoDates) {
    const k = fmtKey.format(new Date(iso));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now - (days - 1 - i) * 86_400_000);
    return { label: fmtLabel.format(d), value: counts.get(fmtKey.format(d)) ?? 0 };
  });
}
