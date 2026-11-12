"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, Input } from "@/components/ui/field";
import { Label, Textarea } from "@/components/admin/ui";
import { savePlan } from "./actions";

type Plan = {
  id: string;
  code: string;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  interval_months: number;
  features: string[];
  is_active: boolean;
  sort_order: number;
};

export function PlanForm({ plan }: { plan?: Plan }) {
  const [state, action, pending] = useActionState(savePlan, undefined);
  const key = plan?.id ?? "new";
  return (
    <form action={action} className="space-y-4">
      {plan ? <input type="hidden" name="id" value={plan.id} /> : null}
      {state?.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state?.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`name-${key}`}>Name</Label>
          <Input id={`name-${key}`} name="name" defaultValue={plan?.name} placeholder="Monthly" required />
        </div>
        <div>
          <Label htmlFor={`code-${key}`}>Code</Label>
          <Input id={`code-${key}`} name="code" defaultValue={plan?.code} placeholder="monthly" required />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Label htmlFor={`price-${key}`}>Price</Label>
          <Input id={`price-${key}`} name="price" type="number" min={0} step="0.01" defaultValue={plan ? plan.price_cents / 100 : ""} required />
        </div>
        <div>
          <Label htmlFor={`currency-${key}`}>Currency</Label>
          <Input id={`currency-${key}`} name="currency" defaultValue={plan?.currency ?? "EGP"} maxLength={3} required />
        </div>
        <div>
          <Label htmlFor={`months-${key}`}>Months</Label>
          <Input id={`months-${key}`} name="interval_months" type="number" min={1} max={24} defaultValue={plan?.interval_months ?? 1} required />
        </div>
      </div>
      <div>
        <Label htmlFor={`desc-${key}`}>Short description</Label>
        <Input id={`desc-${key}`} name="description" defaultValue={plan?.description} />
      </div>
      <div>
        <Label htmlFor={`features-${key}`}>Features (one per line)</Label>
        <Textarea id={`features-${key}`} name="features" rows={4} defaultValue={plan?.features.join("\n")} className="font-sans text-sm" />
      </div>
      <div className="flex flex-wrap items-center gap-5">
        <div className="w-28">
          <Label htmlFor={`order-${key}`}>Order</Label>
          <Input id={`order-${key}`} name="sort_order" type="number" min={0} defaultValue={plan?.sort_order ?? 0} />
        </div>
        <label className="mt-6 flex items-center gap-2 text-sm text-ink-800">
          <input type="checkbox" name="is_active" defaultChecked={plan?.is_active ?? false} className="h-4 w-4 accent-[var(--color-ink-950)]" />
          Visible on the pricing page
        </label>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : plan ? "Save plan" : "Create plan"}
      </Button>
    </form>
  );
}
