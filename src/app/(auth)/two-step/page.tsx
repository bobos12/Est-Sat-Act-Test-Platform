import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { isAdminVerified, isRecentEmailLogin, requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { TwoStepForm } from "./two-step-form";

export const metadata: Metadata = { title: "2-step verification", robots: { index: false } };

export default function TwoStepPage({ searchParams }: PageProps<"/two-step">) {
  return (
    <Suspense fallback={<div className="h-96" />}>
      <TwoStep searchParams={searchParams} />
    </Suspense>
  );
}

async function TwoStep({ searchParams }: { searchParams: PageProps<"/two-step">["searchParams"] }) {
  const viewer = await requireViewer("/two-step");
  if (viewer.role !== "admin") redirect("/dashboard");
  if (await isAdminVerified()) redirect("/admin");
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  const enrolled = Boolean(data?.totp.length);
  const { error } = await searchParams;
  return (
    <TwoStepForm
      enrolled={enrolled}
      email={viewer.email}
      canReset={enrolled && (await isRecentEmailLogin())}
      serviceMissing={error === "service"}
    />
  );
}
