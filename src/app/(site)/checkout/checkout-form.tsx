"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { PAYMENT, type PayMethod } from "@/lib/payment-config";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { quotePlan, submitManualPayment, type Quote } from "./actions";

type PlanInfo = {
  code: string;
  name: string;
  months: number;
  priceCents: number;
  compareAtCents?: number;
  currency: string;
  features: string[];
};

const egp = (cents: number) => `${Math.round(cents / 100).toLocaleString("en-US")} EGP`;

export function ManualCheckout({ plan, userId, extendsAccess }: { plan: PlanInfo; userId: string; extendsAccess: boolean }) {
  const [method, setMethod] = useState<PayMethod>("instapay");
  const [codeInput, setCodeInput] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [codeMsg, setCodeMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [checking, startCheck] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [sender, setSender] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const total = quote?.total_cents ?? plan.priceCents;
  const discount = quote?.discount_cents ?? 0;
  const pay = PAYMENT[method];

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- object URL lifecycle follows the chosen file
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pickFile(f: File | undefined | null) {
    setError(null);
    if (!f) return;
    if (!f.type.startsWith("image/")) return setError("Please choose an image (PNG or JPG screenshot).");
    if (f.size > 8 * 1024 * 1024) return setError("That image is over 8 MB. Please choose a smaller screenshot.");
    setFile(f);
  }

  function applyCode() {
    const code = codeInput.trim();
    if (!code) return;
    startCheck(async () => {
      const res = await quotePlan(plan.code, code);
      if (res.error || !res.quote) {
        setQuote(null);
        setCodeMsg({ tone: "bad", text: res.error ?? "That code isn't valid." });
      } else {
        setQuote(res.quote);
        setCodeMsg({ tone: "ok", text: `Code applied: you save ${egp(res.quote.discount_cents)}.` });
      }
    });
  }

  function removeCode() {
    setQuote(null);
    setCodeInput("");
    setCodeMsg(null);
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      /* clipboard blocked: the number is visible anyway */
    }
  }

  async function submit() {
    if (!file) return setError("Upload the screenshot of your transfer first.");
    setError(null);
    setSubmitting(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await createClient().storage.from("payment-proofs").upload(path, file, { contentType: file.type });
      if (upErr) throw new Error("We couldn't upload the screenshot. Check your connection and try again.");
      const res = await submitManualPayment({ plan: plan.code, method, proofPath: path, sender, code: quote?.code ?? undefined });
      if (res.error) throw new Error(res.error);
      setDone(res.reference ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done !== null) return <Submitted reference={done} planName={plan.name} amount={egp(total)} />;

  const step2Done = true;
  const step3Done = Boolean(file);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
      {/* Steps */}
      <div className="space-y-5">
        <a
          href={`https://wa.me/${PAYMENT.whatsapp}?text=${encodeURIComponent(`Hi 16hundred, I'm outside Egypt and want the ${plan.name} plan.`)}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-success-50 px-5 py-4 text-sm text-success-700 ring-1 ring-success-600/20 transition hover:ring-success-600/50"
        >
          <WhatsAppIcon />
          <span className="flex-1">
            Outside Egypt? Message us on WhatsApp and we&apos;ll set you up: <b className="whitespace-nowrap">{PAYMENT.whatsappDisplay}</b>
          </span>
          <span aria-hidden>→</span>
        </a>

        <Step n={1} title="Choose how you'll pay" done>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["instapay", "vodafone_cash"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                aria-pressed={method === m}
                className={cn(
                  "flex items-center gap-3 rounded-[var(--radius-md)] p-4 text-left ring-1 ring-inset transition",
                  method === m ? "bg-mark-50 ring-2 ring-mark-500" : "bg-white ring-line hover:ring-ink-300",
                )}
              >
                <span
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white",
                    m === "instapay" ? "bg-gradient-to-br from-[#5b2d90] to-[#2c0f55]" : "bg-gradient-to-br from-[#e60000] to-[#9e0000]",
                  )}
                  aria-hidden
                >
                  {m === "instapay" ? "IP" : "VC"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink-950">{PAYMENT[m].label}</span>
                  <span className="block text-xs text-ink-500">{m === "instapay" ? "Any bank app" : "Vodafone wallet"}</span>
                </span>
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full ring-2",
                    method === m ? "bg-mark-500 text-white ring-mark-500" : "ring-line-strong",
                  )}
                >
                  {method === m ? <span className="text-[10px]">✓</span> : null}
                </span>
              </button>
            ))}
          </div>
        </Step>

        <Step n={2} title={`Send ${egp(total)} with ${pay.label}`} done={step2Done}>
          <div className="rounded-[var(--radius-md)] bg-ink-950 p-5 text-paper">
            <p className="text-xs uppercase tracking-[0.14em] text-ink-400">Send to</p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <span className="font-display text-3xl tabular tracking-wide">{pay.to.replace(/(\d{3})(\d{4})(\d{4})/, "$1 $2 $3")}</span>
              <button
                type="button"
                onClick={() => copy(pay.to, "num")}
                className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium transition hover:bg-white/20"
              >
                {copied === "num" ? "Copied ✓" : "Copy number"}
              </button>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
              <span className="text-sm text-ink-300">
                Amount <b className="ml-1 text-lg text-paper tabular">{egp(total)}</b>
              </span>
              <button
                type="button"
                onClick={() => copy(String(Math.round(total / 100)), "amt")}
                className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium transition hover:bg-white/20"
              >
                {copied === "amt" ? "Copied ✓" : "Copy amount"}
              </button>
            </div>
          </div>
          <p className="mt-3 text-sm text-ink-600">
            {pay.hint} Send the exact amount so we can match it quickly.
            {method === "vodafone_cash" ? (
              <>
                {" "}
                On your phone you can also{" "}
                <a href={`tel:*9*7*${pay.to}*${Math.round(total / 100)}%23`} className="font-medium text-mark-500 underline underline-offset-2">
                  dial the transfer code
                </a>
                .
              </>
            ) : null}
          </p>
        </Step>

        <Step n={3} title="Upload your payment screenshot" done={step3Done}>
          <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0])} />
          {file && preview ? (
            <div className="flex items-center gap-4 rounded-[var(--radius-md)] bg-success-50 p-3 ring-1 ring-success-600/30">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
              <img src={preview} alt="Your payment screenshot" className="h-20 w-20 rounded-lg object-cover ring-1 ring-line" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-950">{file.name}</p>
                <p className="text-xs text-success-700">Ready to submit</p>
              </div>
              <button type="button" onClick={() => inputRef.current?.click()} className="text-sm font-medium text-ink-600 hover:text-ink-950">
                Change
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pickFile(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                "flex w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border-2 border-dashed px-6 py-10 text-center transition",
                dragging ? "border-mark-500 bg-mark-50" : "border-line-strong bg-paper hover:border-mark-500 hover:bg-mark-50/50",
              )}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-mark-50 text-mark-500">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
                </svg>
              </span>
              <span className="font-medium text-ink-950">Tap to choose a screenshot</span>
              <span className="text-xs text-ink-500">or drag it here · PNG or JPG, up to 8 MB</span>
            </button>
          )}
          <label className="mt-4 block">
            <span className="text-sm font-medium text-ink-800">
              Number or name you paid from <span className="font-normal text-ink-400">(optional)</span>
            </span>
            <input
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              maxLength={80}
              placeholder="e.g. 010 1234 5678"
              className="mt-1.5 h-11 w-full rounded-[var(--radius-md)] bg-white px-3.5 text-[0.9375rem] ring-1 ring-inset ring-line-strong outline-none focus:ring-2 focus:ring-mark-500"
            />
          </label>
        </Step>

        {error ? <p className="rounded-[var(--radius-md)] bg-danger-50 px-4 py-3 text-sm text-danger-600">{error}</p> : null}

        <button
          type="button"
          onClick={submit}
          disabled={submitting || !file}
          className="h-14 w-full rounded-[var(--radius-md)] bg-mark-500 text-base font-semibold text-white shadow-lg shadow-mark-500/30 transition hover:bg-mark-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          {submitting ? "Submitting…" : file ? `I've paid ${egp(total)}, submit for review` : "Upload your screenshot to continue"}
        </button>
        <p className="text-center text-xs text-ink-500">
          Submit once per payment. We check every payment by hand and unlock your access as soon as it&apos;s confirmed.
        </p>
      </div>

      {/* Summary */}
      <aside className="space-y-4 lg:sticky lg:top-24">
        <div className="overflow-hidden rounded-[var(--radius-lg)] bg-white ring-1 ring-line">
          <div className="bg-ink-950 px-6 py-5 text-paper">
            <p className="text-xs uppercase tracking-[0.14em] text-ink-400">Your plan</p>
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <p className="font-display text-2xl">{plan.name}</p>
              <Link href="/pricing" className="text-xs text-ink-300 underline underline-offset-2 hover:text-paper">
                Change
              </Link>
            </div>
            <p className="mt-1 text-sm text-ink-300">
              {plan.months === 1 ? "1 month" : `${plan.months} months`} of full access{extendsAccess ? ", added after your current access" : ""}
            </p>
          </div>
          <div className="space-y-4 px-6 py-5">
            <div>
              <p className="text-sm font-medium text-ink-800">Discount code</p>
              {quote?.code ? (
                <div className="mt-2 flex items-center justify-between rounded-[var(--radius-md)] bg-success-50 px-3.5 py-2.5 text-sm">
                  <span className="font-mono font-semibold text-success-700">{quote.code}</span>
                  <button type="button" onClick={removeCode} className="text-xs font-medium text-ink-600 hover:text-ink-950">
                    Remove
                  </button>
                </div>
              ) : (
                <div className="mt-2 flex gap-2">
                  <input
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && applyCode()}
                    placeholder="ENTER CODE"
                    maxLength={30}
                    className="h-11 min-w-0 flex-1 rounded-[var(--radius-md)] bg-white px-3.5 font-mono text-sm uppercase tracking-wider ring-1 ring-inset ring-line-strong outline-none focus:ring-2 focus:ring-mark-500"
                  />
                  <button
                    type="button"
                    onClick={applyCode}
                    disabled={checking || !codeInput.trim()}
                    className="h-11 rounded-[var(--radius-md)] px-4 text-sm font-semibold text-ink-950 ring-1 ring-inset ring-line-strong transition hover:bg-paper-2 disabled:opacity-50"
                  >
                    {checking ? "…" : "Apply"}
                  </button>
                </div>
              )}
              {codeMsg ? <p className={cn("mt-2 text-xs", codeMsg.tone === "ok" ? "text-success-700" : "text-danger-600")}>{codeMsg.text}</p> : null}
            </div>

            <dl className="space-y-2 border-t border-line pt-4 text-sm">
              {plan.compareAtCents ? (
                <div className="flex justify-between text-ink-500">
                  <dt>Regular price</dt>
                  <dd className="tabular line-through">{egp(plan.compareAtCents)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between text-ink-700">
                <dt>Plan price</dt>
                <dd className="tabular">{egp(plan.priceCents)}</dd>
              </div>
              {discount > 0 ? (
                <div className="flex justify-between text-success-700">
                  <dt>Discount</dt>
                  <dd className="tabular">−{egp(discount)}</dd>
                </div>
              ) : null}
              <div className="flex items-baseline justify-between border-t border-line pt-3">
                <dt className="font-semibold text-ink-950">Total to pay</dt>
                <dd className="font-display text-3xl tabular text-ink-950">{egp(total)}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="rounded-[var(--radius-lg)] bg-white px-6 py-5 ring-1 ring-line">
          <p className="text-sm font-semibold text-ink-950">What you get</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-700">
            {plan.features.map((f) => (
              <li key={f} className="flex gap-2.5">
                <span className="font-bold text-mark-500">✓</span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-lg)] bg-white p-5 ring-1 ring-line sm:p-6">
      <h2 className="mb-4 flex items-center gap-3 font-semibold text-ink-950">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold",
            done ? "bg-mark-500 text-white" : "bg-paper-2 text-ink-500",
          )}
        >
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Submitted({ reference, planName, amount }: { reference: string; planName: string; amount: string }) {
  return <PendingCard reference={reference} planName={planName} amount={amount} fresh />;
}

export function PendingCard({ reference, planName, amount, fresh }: { reference: string; planName: string; amount: string; fresh?: boolean }) {
  return (
    <div className="mx-auto max-w-xl rounded-[var(--radius-xl)] bg-white p-8 text-center ring-1 ring-line sm:p-10">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-50 text-3xl text-success-600">✓</span>
      <h2 className="mt-5 font-display text-3xl text-ink-950">{fresh ? "Payment submitted!" : "Your payment is being reviewed"}</h2>
      <p className="mt-3 text-ink-600">
        We&apos;re checking your {amount} payment for the <b>{planName}</b> plan. Your access unlocks automatically as soon as it&apos;s
        confirmed.
      </p>
      <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full bg-paper-2 px-4 py-2 font-mono text-sm text-ink-700">
        Reference <b className="text-ink-950">{reference}</b>
      </div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href="/exams" className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-ink-950 px-5 text-sm font-medium text-paper hover:bg-ink-800">
          Keep practising free exams
        </Link>
        <a
          href={`https://wa.me/${PAYMENT.whatsapp}?text=${encodeURIComponent(`Hi 16hundred, I just paid for ${planName}. Reference ${reference}.`)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] px-5 text-sm font-medium text-success-700 ring-1 ring-inset ring-success-600/40 hover:bg-success-50"
        >
          <WhatsAppIcon /> Message us on WhatsApp
        </a>
      </div>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2a8.2 8.2 0 01-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 01-3.3-2.9c-.3-.4.3-.4.7-1.3a.5.5 0 000-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 00-.7.3 3 3 0 00-.9 2.2 5.2 5.2 0 001.1 2.7 11.8 11.8 0 004.5 4c1.7.7 2.3.8 3.1.6a2.7 2.7 0 001.8-1.2 2.2 2.2 0 00.1-1.2c0-.1-.2-.2-.4-.3z" />
    </svg>
  );
}
