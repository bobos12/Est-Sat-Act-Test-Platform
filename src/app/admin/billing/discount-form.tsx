"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, Input } from "@/components/ui/field";
import { Label, Select } from "@/components/admin/ui";
import { saveDiscount } from "./actions";

export function DiscountForm() {
  const [state, action, pending] = useActionState(saveDiscount, undefined);
  return (
    <form action={action} className="space-y-3">
      {state?.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state?.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}
      <div>
        <Label htmlFor="code">Code</Label>
        <Input id="code" name="code" placeholder="EST20" className="font-mono uppercase" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="kind">Type</Label>
          <Select id="kind" name="kind" defaultValue="percent">
            <option value="percent">% off</option>
            <option value="amount">EGP off</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="value">Value</Label>
          <Input id="value" name="value" type="number" min="1" step="1" placeholder="20" required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="expires_at">Expires (optional)</Label>
          <Input id="expires_at" name="expires_at" type="date" />
        </div>
        <div>
          <Label htmlFor="max_uses">Max uses (optional)</Label>
          <Input id="max_uses" name="max_uses" type="number" min="1" step="1" placeholder="Unlimited" />
        </div>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Create code"}
      </Button>
    </form>
  );
}
