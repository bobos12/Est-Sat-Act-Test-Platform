"use server";

import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type Enrollment = { factorId?: string; qr?: string; secret?: string; error?: string };
export type CodeState = { error?: string } | undefined;

async function adminSupabase() {
  const viewer = await requireViewer("/two-step");
  if (viewer.role !== "admin") redirect("/dashboard");
  return createClient();
}

/** First-time setup: a fresh authenticator secret and its QR code. */
export async function startEnrollment(): Promise<Enrollment> {
  const supabase = await adminSupabase();
  const { data: list } = await supabase.auth.mfa.listFactors();
  if (list?.totp.length) return { error: "2-step verification is already set up. Enter a code from your app instead." };
  // Clear abandoned setups so the new QR code is the only pending one.
  for (const f of list?.all ?? []) {
    if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `TargetScore admin ${Date.now()}`, issuer: "TargetScore" });
  if (error || !data) return { error: "We couldn't start the setup. Check that TOTP MFA is enabled in Supabase Auth, then try again." };
  const qr = data.totp.qr_code.startsWith("data:") ? data.totp.qr_code : `data:image/svg+xml;utf-8,${encodeURIComponent(data.totp.qr_code)}`;
  return { factorId: data.id, qr, secret: data.totp.secret };
}

/** Verify a 6-digit code: finishes setup (factorId given) or signs in with the existing factor. */
export async function verifyCode(_: CodeState, formData: FormData): Promise<CodeState> {
  const supabase = await adminSupabase();
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return { error: "Enter the 6-digit code from your authenticator app." };

  const { data: list } = await supabase.auth.mfa.listFactors();
  const requested = String(formData.get("factorId") ?? "");
  const factor = requested ? list?.all.find((f) => f.id === requested && f.factor_type === "totp") : list?.totp[0];
  if (!factor) return { error: "Set up 2-step verification first." };

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) return { error: "That code didn't work. Use the newest code in the app, and check your phone's clock is set automatically." };
  redirect("/admin");
}
