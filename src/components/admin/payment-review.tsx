import Link from "next/link";
import { refundPayment, reviewPayment } from "@/app/admin/payments/actions";
import { ConfirmSubmit, SubmitButton } from "./client";
import { Icon } from "./icons";
import { Avatar, adminDate, money, providerName } from "./ui";

export type ReviewItem = {
  id: string;
  provider: string;
  merchant_reference: string;
  amount_cents: number;
  currency: string;
  created_at: string;
  user_id: string;
  planName?: string | null;
  student?: { full_name: string | null; email: string; phone?: string | null } | null;
  payload: { sender?: string; code?: string; discount_cents?: number };
  proofUrl?: string | null;
};

/** One manual payment waiting for review: screenshot, who paid, and approve / reject. */
export function ReviewCard({ r, back, showStudent = true }: { r: ReviewItem; back: string; showStudent?: boolean }) {
  return (
    <li className="grid gap-5 p-5 md:grid-cols-[180px_1fr_240px] md:items-start">
      {r.proofUrl ? (
        <a href={r.proofUrl} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-[var(--radius-md)] bg-paper-2 ring-1 ring-line hover:ring-mark-500">
          {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
          <img src={r.proofUrl} alt="Payment screenshot" className="h-48 w-full object-cover object-top transition group-hover:scale-[1.02]" />
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-ink-950/70 py-1.5 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
            <Icon name="external" size={12} /> Open full size
          </span>
        </a>
      ) : (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] bg-paper-2 text-xs text-ink-500">
          <Icon name="alert" size={20} />
          No screenshot uploaded
        </div>
      )}
      <div className="min-w-0 space-y-3 text-sm">
        <div>
          <p className="text-2xl font-semibold tabular text-ink-950">{money(r.amount_cents, r.currency)}</p>
          <p className="text-ink-600">{r.planName ?? "Plan"}</p>
        </div>
        {showStudent && r.student ? (
          <Link href={`/admin/students/${r.user_id}`} className="flex items-center gap-2.5 rounded-[var(--radius-md)] p-2 ring-1 ring-line transition hover:bg-paper">
            <Avatar name={r.student.full_name || r.student.email} size={32} />
            <span className="min-w-0">
              <span className="block truncate font-medium text-ink-950">{r.student.full_name || r.student.email}</span>
              <span className="block truncate text-xs text-ink-500">
                {r.student.email}
                {r.student.phone ? ` · ${r.student.phone}` : ""}
              </span>
            </span>
          </Link>
        ) : null}
        <dl className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-1 text-[0.8125rem]">
          <dt className="text-ink-500">Method</dt>
          <dd className="font-medium text-ink-900">{providerName(r.provider)}</dd>
          <dt className="text-ink-500">Paid from</dt>
          <dd className="font-medium text-ink-900">{r.payload.sender || "—"}</dd>
          {r.payload.code ? (
            <>
              <dt className="text-ink-500">Discount</dt>
              <dd className="text-ink-900">
                <span className="font-mono">{r.payload.code}</span> (−{money(r.payload.discount_cents ?? 0, r.currency)})
              </dd>
            </>
          ) : null}
          <dt className="text-ink-500">Reference</dt>
          <dd className="font-mono text-xs text-ink-700">{r.merchant_reference}</dd>
          <dt className="text-ink-500">Sent</dt>
          <dd className="text-ink-700">{adminDate.format(new Date(r.created_at))}</dd>
        </dl>
      </div>
      <form action={reviewPayment} className="flex flex-col gap-2">
        <input type="hidden" name="id" value={r.id} />
        <input type="hidden" name="back" value={back} />
        <SubmitButton name="decision" value="approve" variant="success" icon="check" pendingLabel="Approving…" className="h-11 w-full">
          Approve &amp; unlock
        </SubmitButton>
        <ConfirmSubmit
          name="decision"
          value="reject"
          variant="danger-outline"
          className="w-full"
          title="Reject this payment?"
          confirmLabel="Reject payment"
          pendingLabel="Rejecting…"
          body={
            <div className="space-y-2">
              <p>
                {money(r.amount_cents, r.currency)} from {r.student?.full_name || r.student?.email || "this student"}. They will see the payment as failed with your reason.
              </p>
              <input
                name="reason"
                maxLength={200}
                placeholder="Reason, e.g. Amount not received"
                className="h-10 w-full rounded-[var(--radius-md)] px-3 text-sm text-ink-950 ring-1 ring-inset ring-line-strong focus:outline-none focus:ring-2 focus:ring-mark-500"
              />
            </div>
          }
        >
          Reject
        </ConfirmSubmit>
        <p className="text-center text-xs text-ink-500">Check the amount and sender match before approving.</p>
      </form>
    </li>
  );
}

/** "Refund" for a paid payment: asks for a reason, then ends the access it bought. */
export function RefundButton({ id, label, back }: { id: string; label: string; back: string }) {
  return (
    <form action={refundPayment}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="back" value={back} />
      <ConfirmSubmit
        size="xs"
        variant="ghost"
        title="Mark this payment as refunded?"
        confirmLabel="Mark refunded"
        pendingLabel="Saving…"
        body={
          <div className="space-y-2">
            <p>
              Use this after you&apos;ve sent {label} back to the student. The payment is marked <b>refunded</b> and the premium access it bought ends now.
            </p>
            <input
              name="note"
              required
              minLength={3}
              maxLength={300}
              placeholder="Reason, e.g. Paid twice"
              className="h-10 w-full rounded-[var(--radius-md)] px-3 text-sm text-ink-950 ring-1 ring-inset ring-line-strong focus:outline-none focus:ring-2 focus:ring-mark-500"
            />
          </div>
        }
      >
        Refund…
      </ConfirmSubmit>
    </form>
  );
}
