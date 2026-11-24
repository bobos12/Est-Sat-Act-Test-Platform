"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type ComponentProps,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import { FormMessage } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { Icon, Spinner, type IconName } from "./icons";

/* ------------------------------------------------------------------ */
/* Buttons that show they're working                                   */
/* ------------------------------------------------------------------ */

export type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-outline" | "success" | "dark";
export type BtnSize = "xs" | "sm" | "md";

const variantCls: Record<BtnVariant, string> = {
  primary: "bg-mark-500 text-white hover:bg-mark-600 shadow-sm",
  dark: "bg-ink-950 text-white hover:bg-ink-800 shadow-sm",
  secondary: "bg-white text-ink-900 ring-1 ring-inset ring-line-strong hover:bg-paper-2",
  ghost: "text-ink-600 hover:bg-paper-2 hover:text-ink-950",
  danger: "bg-danger-600 text-white hover:opacity-90 shadow-sm",
  "danger-outline": "bg-white text-danger-600 ring-1 ring-inset ring-danger-600/40 hover:bg-danger-50",
  success: "bg-success-600 text-white hover:bg-success-700 shadow-sm",
};
const sizeCls: Record<BtnSize, string> = {
  xs: "h-7 px-2.5 text-xs gap-1",
  sm: "h-8 px-3 text-[0.8125rem] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
};

export function btn(variant: BtnVariant = "secondary", size: BtnSize = "md", className?: string) {
  return cn(
    "relative inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
    variantCls[variant],
    sizeCls[size],
    className,
  );
}

type SubmitProps = Omit<ComponentProps<"button">, "type"> & {
  variant?: BtnVariant;
  size?: BtnSize;
  icon?: IconName;
  /** Text shown while the form is submitting, e.g. "Saving…". */
  pendingLabel?: string;
};

/**
 * Submit button for server-action forms. While the action runs it shows a spinner
 * (only on the button that was clicked) and disables every other submit in the form.
 */
export function SubmitButton({ variant = "dark", size = "md", icon, pendingLabel, children, className, name, value, disabled, ...rest }: SubmitProps) {
  const { pending, data } = useFormStatus();
  const mine = pending && (!name || data?.get(name) === String(value ?? ""));
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={disabled || pending}
      aria-busy={mine || undefined}
      className={btn(variant, size, className)}
      {...rest}
    >
      {mine ? <Spinner size={size === "xs" ? 12 : 14} /> : icon ? <Icon name={icon} size={size === "xs" ? 13 : 15} /> : null}
      {mine && pendingLabel ? pendingLabel : children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Dialogs                                                             */
/* ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-[var(--radius-lg)] bg-white p-0 text-left shadow-2xl ring-1 ring-line backdrop:bg-ink-950/40 backdrop:backdrop-blur-[2px]",
        "open:animate-[admin-pop_160ms_ease-out]",
        wide ? "max-w-2xl" : "max-w-md",
      )}
    >
      {open ? (
        <div>
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-ink-950">{title}</h2>
              {description ? <p className="mt-0.5 text-sm text-ink-500">{description}</p> : null}
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 rounded-md p-1 text-ink-400 hover:bg-paper-2 hover:text-ink-950">
              <Icon name="x" size={18} />
            </button>
          </div>
          <div className="px-5 py-4">{children}</div>
        </div>
      ) : null}
    </dialog>
  );
}

/** A button that opens a dialog. Pass the dialog body as a render function so it can close itself. */
export function DialogButton({
  label,
  icon,
  variant = "secondary",
  size = "md",
  title,
  description,
  wide,
  className,
  children,
}: {
  label: ReactNode;
  icon?: IconName;
  variant?: BtnVariant;
  size?: BtnSize;
  title: ReactNode;
  description?: ReactNode;
  wide?: boolean;
  className?: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btn(variant, size, className)}>
        {icon ? <Icon name={icon} size={size === "xs" ? 13 : 15} /> : null}
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} description={description} wide={wide}>
        {children(() => setOpen(false))}
      </Modal>
    </>
  );
}

/**
 * Submit button that asks "are you sure?" first. It must sit inside the form it submits;
 * the confirm button inside the dialog is a real submit of that form (with name/value).
 */
export function ConfirmSubmit({
  children,
  title,
  body,
  confirmLabel,
  tone = "danger",
  variant = "danger-outline",
  size = "md",
  icon,
  name,
  value,
  className,
  pendingLabel,
}: {
  children: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
  variant?: BtnVariant;
  size?: BtnSize;
  icon?: IconName;
  name?: string;
  value?: string;
  className?: string;
  pendingLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const { pending } = useFormStatus();
  const wasPending = useRef(false);
  useEffect(() => {
    // Close once the action has finished.
    if (wasPending.current && !pending) setOpen(false);
    wasPending.current = pending;
  }, [pending]);
  return (
    <>
      <button type="button" disabled={pending} onClick={() => setOpen(true)} className={btn(variant, size, className)}>
        {pending && !open ? <Spinner size={14} /> : icon ? <Icon name={icon} size={size === "xs" ? 13 : 15} /> : null}
        {children}
      </button>
      <Modal open={open} onClose={() => !pending && setOpen(false)} title={title}>
        {body ? <div className="text-sm text-ink-600">{body}</div> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={pending} onClick={() => setOpen(false)} className={btn("secondary", "md")}>
            Cancel
          </button>
          <SubmitButton name={name} value={value} variant={tone === "danger" ? "danger" : "primary"} pendingLabel={pendingLabel ?? "Working…"}>
            {confirmLabel}
          </SubmitButton>
        </div>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Toasts                                                              */
/* ------------------------------------------------------------------ */

type ToastItem = { id: number; tone: "success" | "error" | "info"; text: string };
let toasts: ToastItem[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
let nextId = 1;

export function toast(text: string, tone: ToastItem["tone"] = "success") {
  const id = nextId++;
  toasts = [...toasts, { id, tone, text }].slice(-4);
  emit();
  setTimeout(() => dismiss(id), tone === "error" ? 7000 : 4000);
}
function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function Toaster() {
  const items = useSyncExternalStore(
    subscribe,
    () => toasts,
    () => toasts,
  );
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100%-2rem))] flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className="pointer-events-auto flex animate-[admin-slide_200ms_ease-out] items-start gap-3 rounded-[var(--radius-md)] bg-ink-950 px-4 py-3 text-sm text-white shadow-xl"
        >
          <span
            className={cn(
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
              t.tone === "success" ? "bg-success-600" : t.tone === "error" ? "bg-danger-600" : "bg-mark-500",
            )}
          >
            <Icon name={t.tone === "success" ? "check" : t.tone === "error" ? "alert" : "info"} size={12} strokeWidth={3} />
          </span>
          <p className="flex-1 leading-snug">{t.text}</p>
          <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-white/50 hover:text-white">
            <Icon name="x" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Turns ?ok= / ?error= left by redirecting actions into a toast, then cleans the URL. */
export function FlashToast() {
  const sp = useSearchParams();
  const ok = sp.get("ok");
  const error = sp.get("error");
  useEffect(() => {
    if (!ok && !error) return;
    if (ok) toast(ok, "success");
    if (error) toast(error, "error");
    const url = new URL(window.location.href);
    url.searchParams.delete("ok");
    url.searchParams.delete("error");
    window.history.replaceState(null, "", url.pathname + (url.search || ""));
  }, [ok, error]);
  return null;
}

/** Inline result of a useActionState form, also announced as a toast. */
export function ActionMessage({ state }: { state: { ok?: string; error?: string } | undefined }) {
  const last = useRef<typeof state>(undefined);
  useEffect(() => {
    if (state && state !== last.current && state.ok) toast(state.ok, "success");
    last.current = state;
  }, [state]);
  if (state?.error) return <FormMessage>{state.error}</FormMessage>;
  if (state?.ok) return <FormMessage tone="success">{state.ok}</FormMessage>;
  return null;
}

/* ------------------------------------------------------------------ */
/* Navigation progress bar                                             */
/* ------------------------------------------------------------------ */

/**
 * Thin bar at the top of the screen from the moment a link is clicked (or a GET form
 * submitted) until the new page is on screen, so a click never looks ignored.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // The route changed: finish the bar.
  const key = `${pathname}?${search}`;
  const [prevKey, setPrevKey] = useState(key);
  if (key !== prevKey) {
    setPrevKey(key);
    if (phase === "loading") setPhase("done");
  }
  useEffect(() => {
    clearTimeout(timer.current);
    if (phase === "done") timer.current = setTimeout(() => setPhase("idle"), 350);
    if (phase === "loading") timer.current = setTimeout(() => setPhase("idle"), 20000);
    return () => clearTimeout(timer.current);
  }, [phase]);

  useEffect(() => {
    const start = (url: URL) => {
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      setPhase("loading");
    };
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      start(new URL(a.href, location.href));
    };
    const onSubmit = (e: SubmitEvent) => {
      const f = e.target as HTMLFormElement;
      if (f.method.toLowerCase() !== "get" || typeof f.getAttribute("action") !== "string") return;
      const url = new URL(f.action, location.href);
      url.search = new URLSearchParams(new FormData(f) as unknown as Record<string, string>).toString();
      start(url);
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px]">
      <div
        className={cn(
          "h-full bg-mark-500 shadow-[0_0_8px_var(--color-mark-500)]",
          phase === "idle" && "w-0 opacity-0 transition-none",
          phase === "loading" && "w-[85%] opacity-100 transition-[width] duration-[6000ms] ease-out",
          phase === "done" && "w-full opacity-0 transition-[width,opacity] duration-300",
        )}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Live search box                                                     */
/* ------------------------------------------------------------------ */

/** Search that updates the list as you type (debounced) and shows a spinner while it loads. */
export function SearchBox({ placeholder, param = "q", className, autoFocus }: { placeholder: string; param?: string; className?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [value, setValue] = useState(sp.get(param) ?? "");
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const push = (v: string) => {
    const next = new URLSearchParams(sp.toString());
    if (v.trim()) next.set(param, v.trim());
    else next.delete(param);
    next.delete("page");
    startTransition(() => router.replace(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false }));
  };

  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">
        {pending ? <Spinner size={16} className="text-mark-500" /> : <Icon name="search" size={16} />}
      </span>
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => {
          setValue(e.target.value);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => push(e.target.value), 350);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            clearTimeout(timer.current);
            push(value);
          }
        }}
        className="h-10 w-full rounded-[var(--radius-md)] bg-white pl-9 pr-3 text-sm text-ink-950 ring-1 ring-inset ring-line-strong placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-mark-500"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Instant tabs (all panels rendered on the server, switched locally)  */
/* ------------------------------------------------------------------ */

export function Tabs({ tabs, initial }: { tabs: { id: string; label: string; count?: number; icon?: IconName; content: ReactNode }[]; initial?: string }) {
  const [active, setActive] = useState(() => (tabs.some((t) => t.id === initial) ? initial! : tabs[0].id));
  const select = (id: string) => {
    setActive(id);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", id);
    window.history.replaceState(null, "", url.pathname + url.search);
  };
  return (
    <div>
      <div role="tablist" className="sticky top-14 z-20 -mx-1 mb-6 flex gap-1 overflow-x-auto border-b border-line bg-paper/95 px-1 backdrop-blur [scrollbar-width:none] lg:top-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active === t.id}
            onClick={() => select(t.id)}
            className={cn(
              "relative inline-flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-3 text-sm font-medium transition",
              active === t.id ? "text-ink-950" : "text-ink-500 hover:text-ink-900",
            )}
          >
            {t.icon ? <Icon name={t.icon} size={15} /> : null}
            {t.label}
            {t.count !== undefined ? (
              <span className={cn("rounded-full px-1.5 text-xs tabular", active === t.id ? "bg-ink-950 text-white" : "bg-paper-3 text-ink-600")}>{t.count}</span>
            ) : null}
            {active === t.id ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-mark-500" /> : null}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" hidden={active !== t.id}>
          {t.content}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          toast("Copied to clipboard", "info");
          setTimeout(() => setDone(false), 1500);
        } catch {
          toast("Couldn't copy — select the text instead.", "error");
        }
      }}
      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-ink-400 transition hover:bg-paper-2 hover:text-ink-900"
    >
      <Icon name={done ? "check" : "copy"} size={14} />
    </button>
  );
}

/** Checkbox in a table header that ticks every row checkbox with the same name in its form. */
export function SelectAll({ name = "ids" }: { name?: string }) {
  return (
    <input
      type="checkbox"
      aria-label="Select all"
      className="h-4 w-4 accent-mark-500"
      onChange={(e) => {
        const form = e.currentTarget.form;
        form?.querySelectorAll<HTMLInputElement>(`input[type=checkbox][name="${name}"]`).forEach((c) => (c.checked = e.currentTarget.checked));
        form?.dispatchEvent(new Event("change", { bubbles: true }));
      }}
    />
  );
}

/** "3 selected" live count for bulk-action bars. */
export function SelectedCount({ name = "ids" }: { name?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const update = () => setN(form.querySelectorAll(`input[type=checkbox][name="${name}"]:checked`).length);
    form.addEventListener("change", update);
    return () => form.removeEventListener("change", update);
  }, [name]);
  return (
    <span ref={ref} className={cn("text-sm font-medium transition", n ? "text-mark-600" : "text-ink-500")}>
      {n ? `${n} selected` : "Tick rows to change several at once"}
    </span>
  );
}
