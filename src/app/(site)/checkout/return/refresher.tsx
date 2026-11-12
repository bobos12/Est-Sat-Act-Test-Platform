"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-checks the payment status every few seconds while the webhook is on its way. */
export function Refresher({ attempts }: { attempts: number }) {
  const router = useRouter();
  useEffect(() => {
    if (attempts >= 20) return;
    const t = setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("n", String(attempts + 1));
      router.replace(url.pathname + url.search);
    }, 3000);
    return () => clearTimeout(t);
  }, [attempts, router]);
  return null;
}
