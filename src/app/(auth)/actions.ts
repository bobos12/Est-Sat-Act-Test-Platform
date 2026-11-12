"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";

export type AuthState = { error?: string; fieldErrors?: Record<string, string>; notice?: string } | undefined;

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
    return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      error:
        error.code === "email_not_confirmed"
          ? "Please confirm your email first — check your inbox for the link."
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
    return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  }
  const next = safeNext(formData.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    return { error: error.code === "user_already_exists" ? "An account with this email already exists." : error.message };
  }
  if (!data.session) {
    return { notice: `We sent a confirmation link to ${parsed.data.email}. Open it to activate your account.` };
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
