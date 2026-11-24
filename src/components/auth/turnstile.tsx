"use client";

import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let loading: Promise<void> | null = null;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("Turnstile failed to load"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * Invisible bot check (Cloudflare Turnstile). Inside a form it adds a hidden
 * `cf-turnstile-response` field; real visitors normally never see a challenge.
 * Renders nothing until NEXT_PUBLIC_TURNSTILE_SITE_KEY is set.
 * Tokens work once: change `resetKey` after every submit.
 */
export function Turnstile({ action, resetKey, field = true, onToken }: { action: string; resetKey?: unknown; field?: boolean; onToken?: (token: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);
  const tokenCb = useRef(onToken);
  useEffect(() => {
    tokenCb.current = onToken;
  });

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !el.current || !window.turnstile) return;
        id.current = window.turnstile.render(el.current, {
          sitekey: SITE_KEY,
          action,
          appearance: "interaction-only",
          "response-field": field,
          callback: (token: string) => tokenCb.current?.(token),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (id.current && window.turnstile) window.turnstile.remove(id.current);
      id.current = null;
    };
  }, [action, field]);

  useEffect(() => {
    if (id.current && window.turnstile) window.turnstile.reset(id.current);
  }, [resetKey]);

  if (!SITE_KEY) return null;
  return <div ref={el} className="flex justify-center" />;
}
