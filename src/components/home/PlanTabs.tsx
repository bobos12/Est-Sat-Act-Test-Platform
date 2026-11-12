"use client";

import { Children, useState } from "react";

/** On phones: tabs pick one plan to show. On larger screens every plan shows side by side. */
export function PlanTabs({
  tabs,
  initial,
  children,
}: {
  tabs: { label: string; sub: string; badge?: string }[];
  initial: number;
  children: React.ReactNode;
}) {
  const [active, setActive] = useState(initial);
  const items = Children.toArray(children);
  return (
    <>
      <div className="plan-tabs" role="tablist" aria-label="Choose a plan">
        {tabs.map((t, i) => (
          <button key={t.label} type="button" role="tab" aria-selected={i === active} className="plan-tab" onClick={() => setActive(i)}>
            {t.badge ? <em>{t.badge}</em> : null}
            <b>{t.label}</b>
            <span>{t.sub}</span>
          </button>
        ))}
      </div>
      <div className="plans three">
        {items.map((child, i) => (
          <div key={i} className="plan-slot" data-on={i === active}>
            {child}
          </div>
        ))}
      </div>
    </>
  );
}
