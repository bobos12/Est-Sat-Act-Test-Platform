import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { isAdminVerified, requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { TwoStepForm } from "./two-step-form";

export const metadata: Metadata = { title: "2-step verification", robots: { index: false } };

export default function TwoStepPage() {
  return (
    <Suspense fallback={<div className="h-96" />}>
      <TwoStep />
    </Suspense>
  );
}

async function TwoStep() {
  const viewer = await requireViewer("/two-step");
  if (viewer.role !== "admin") redirect("/dashboard");
  if (await isAdminVerified()) redirect("/admin");
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  return <TwoStepForm enrolled={Boolean(data?.totp.length)} />;
}
