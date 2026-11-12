import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { AdminNav, AdminNavFallback } from "@/components/admin/nav";
import { requireAdmin } from "@/lib/auth/session";

export const metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false } };

// Every admin route is gated on the server before any admin content renders,
// and every admin query also passes through RLS (is_admin()).
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="border-b border-line bg-white px-4 py-4 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:py-6">
        <div className="flex items-center justify-between lg:block">
          <Link href="/admin" className="lg:px-2">
            <Logo />
          </Link>
          <span className="rounded-full bg-paper-2 px-2 py-0.5 text-xs font-medium text-ink-600 lg:mt-3 lg:ml-2 lg:inline-block">Admin</span>
        </div>
        <div className="mt-4 lg:mt-8">
          <Suspense fallback={<AdminNavFallback />}>
            <AdminNav />
          </Suspense>
        </div>
        <div className="mt-8 hidden px-3 text-sm lg:block">
          <Link href="/" className="text-ink-500 hover:text-ink-950">
            ← View site
          </Link>
        </div>
      </aside>
      <div className="min-w-0">
        <Suspense fallback={<div className="p-10 text-sm text-ink-500">Loading…</div>}>
          <AdminGate>{children}</AdminGate>
        </Suspense>
      </div>
    </div>
  );
}

async function AdminGate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-10">{children}</main>;
}
