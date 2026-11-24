"use server";

import { adminClient } from "@/lib/admin/server";

export type SearchHit = { kind: "student" | "exam" | "payment"; id: string; title: string; subtitle: string; href: string };

/** Quick search behind the admin command palette (Ctrl+K). */
export async function adminSearch(raw: string): Promise<SearchHit[]> {
  const q = raw.trim().slice(0, 80).replace(/[%,()*\\]/g, " ").trim();
  if (q.length < 2) return [];
  const { supabase } = await adminClient();
  const [{ data: students }, { data: exams }, { data: payments }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, phone, role")
      .or(`email.ilike.%${q}%,full_name.ilike.%${q}%,phone.ilike.%${q}%`)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("exams").select("id, title, status, access, subjects(name)").ilike("title", `%${q}%`).order("updated_at", { ascending: false }).limit(6),
    supabase
      .from("payments")
      .select("id, merchant_reference, user_id, status, amount_cents, currency")
      .ilike("merchant_reference", `%${q}%`)
      .limit(4),
  ]);
  return [
    ...(students ?? []).map((s) => ({
      kind: "student" as const,
      id: s.id,
      title: s.full_name || s.email,
      subtitle: [s.email, s.phone, s.role === "admin" ? "Admin" : null].filter(Boolean).join(" · "),
      href: `/admin/students/${s.id}`,
    })),
    ...(exams ?? []).map((e) => {
      const subject = Array.isArray(e.subjects) ? e.subjects[0] : e.subjects;
      return {
        kind: "exam" as const,
        id: e.id,
        title: e.title,
        subtitle: [subject?.name, e.status.replace("_", " "), e.access].filter(Boolean).join(" · "),
        href: `/admin/exams/${e.id}`,
      };
    }),
    ...(payments ?? []).map((p) => ({
      kind: "payment" as const,
      id: p.id,
      title: p.merchant_reference,
      subtitle: `${(p.amount_cents / 100).toLocaleString("en")} ${p.currency} · ${p.status}`,
      href: `/admin/students/${p.user_id}?tab=payments`,
    })),
  ];
}
