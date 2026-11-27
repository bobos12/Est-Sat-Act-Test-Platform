import { brand } from "@/lib/brand";

/** Marketing extras that sit beside the plans and content in the database. */

/** Strike-through price, badge and "Most popular" flag, keyed by plan code. */
export const PLAN_EXTRAS: Record<string, { compareAtCents?: number; popular?: boolean; cta: string; hook: string }> = {
  monthly: { compareAtCents: 60000, cta: "Start monthly", hook: "Try everything. Cancel anytime." },
  quarterly: { compareAtCents: 125000, popular: true, cta: "Get 3 months", hook: "Covers a full exam season" },
  yearly: { cta: "Get the full year", hook: "For students aiming for a top score" },
};

/** Per-month price and saving against the monthly plan, for the pricing cards. */
export function planPitch(plan: { code: string; price_cents: number; interval_months: number }, monthlyCents?: number) {
  const perMonth = Math.round(plan.price_cents / plan.interval_months / 100) * 100;
  const extra = PLAN_EXTRAS[plan.code];
  const saveVsMonthly = monthlyCents && plan.interval_months > 1 ? Math.round((1 - perMonth / monthlyCents) * 100) : 0;
  const saveVsCompare = extra?.compareAtCents ? Math.round((1 - plan.price_cents / extra.compareAtCents) * 100) : 0;
  const perDay = plan.interval_months === 12 ? Math.ceil(plan.price_cents / 365 / 100) : 0;
  // A crossed-out price sets the saving shown, so the badge always matches what the card shows.
  return { perMonth, save: saveVsCompare || saveVsMonthly, perDay, cta: extra?.cta ?? "Subscribe", hook: extra?.hook ?? "", popular: Boolean(extra?.popular), compareAtCents: extra?.compareAtCents, savedCents: extra?.compareAtCents ? extra.compareAtCents - plan.price_cents : 0 };
}

export const periodLabel = (months: number) => (months === 1 ? "month" : months === 12 ? "year" : `${months} months`);

/**
 * Real student testimonials only. The homepage section stays hidden while this list is empty.
 * Add entries like: { name: "Mariam A.", detail: "EST I · 1480", quote: "…" }
 */
export const TESTIMONIALS: { name: string; detail: string; quote: string }[] = [];

/** Contact channels. Empty values are not shown. */
export const CONTACT = {
  email: brand.supportEmail,
  whatsapp: "", // e.g. "201000000000" (international format, digits only)
  instagram: "", // handle without @
  tiktok: "", // handle without @
};
