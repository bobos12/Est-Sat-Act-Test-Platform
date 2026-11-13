"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";

export type AuthState = { error?: string; fieldErrors?: Record<string, string>; notice?: string; email?: string } | undefined;

/** The site the visitor is actually on (live domain, preview or localhost), so email links come back to it. */
async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return publicEnv().NEXT_PUBLIC_SITE_URL;
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Only allow same-site relative redirects. */
function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export async function signIn(_: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured()) return { error: "Sign-in is not available yet." };
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])), email: String(formData.get("email") ?? "") };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      email: parsed.data.email,
      error:
        error.code === "email_not_confirmed"
          ? "Please confirm your email first. Check your inbox, or resend the link below."
          : "That email and password don't match an account.",
    };
  }
  redirect(safeNext(formData.get("next")));
}

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(72)
    .regex(/[A-Za-z]/, "Include at least one letter.")
    .regex(/\d/, "Include at least one number."),
});

export async function signUp(_: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured()) return { error: "Registration is not available yet." };
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])), email: String(formData.get("email") ?? "") };
  }
  const next = safeNext(formData.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    return {
      email: parsed.data.email,
      error: error.code === "user_already_exists" ? "An account with this email already exists. Sign in instead." : error.message,
    };
  }
  if (!data.session) {
    return { notice: "confirm", email: parsed.data.email };
  }
  redirect(next);
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}

/** Send the confirmation email again. */
export async function resendConfirmation(email: string): Promise<{ ok?: boolean; error?: string }> {
  const parsed = z.string().trim().toLowerCase().email().safeParse(email);
  if (!parsed.success) return { error: "Enter a valid email address." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=/dashboard` },
  });
  if (error) return { error: error.message.includes("seconds") ? "Please wait a minute before asking again." : "We couldn't resend the email. Try again in a minute." };
  return { ok: true };
}

/** Forgot password: email a reset link that lands on /reset-password. */
export async function requestPasswordReset(_: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured()) return { error: "Password reset is not available yet." };
  const parsed = z.string().trim().toLowerCase().email().safeParse(formData.get("email"));
  if (!parsed.success) return { fieldErrors: { email: "Enter a valid email address." } };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${await siteOrigin()}/auth/confirm?next=/reset-password`,
  });
  // Same answer whether or not the account exists, so emails can't be probed.
  return { notice: "reset", email: parsed.data };
}

const newPasswordSchema = signUpSchema.shape.password;

/** Set a new password (the reset link has already signed the user in). */
export async function updatePassword(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = newPasswordSchema.safeParse(formData.get("password"));
  if (!parsed.success) return { fieldErrors: { password: parsed.error.issues[0].message } };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return { error: error.message.includes("session") ? "This reset link has expired. Ask for a new one." : error.message };
  redirect("/dashboard");
}
