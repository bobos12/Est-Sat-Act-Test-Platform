import Link from "next/link";
import { cache, Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { AdminNav, AdminNavFallback, CommandPalette, MobileNav, MobileNavFallback, SearchTrigger } from "@/components/admin/nav";
import { FlashToast, NavProgress, Toaster } from "@/components/admin/client";
import { Icon } from "@/components/admin/icons";
import { PageSkeleton } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false } };

const brand = (
  <Link href="/admin" className="flex items-center gap-2">
    <Logo />
    <span className="rounded-md bg-ink-950 px-1.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-white">Admin</span>
  </Link>
);

// Every admin route is gated on the server before any admin content renders,
// and every admin query also passes through RLS (is_admin()).
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[248px_1fr]">
      <Suspense fallback={null}>
        <NavProgress />
        <FlashToast />
      </Suspense>
      <Toaster />
      <CommandPalette />

      <Suspense fallback={<MobileNavFallback brand={brand} />}>
        <MobileNavWithBadges />
      </Suspense>

      <aside className="hidden border-r border-line bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="px-5 pb-4 pt-6">{brand}</div>
        <div className="px-3 pb-4">
          <SearchTrigger />
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-6">
          <Suspense fallback={<AdminNavFallback />}>
            <AdminNavWithBadges />
          </Suspense>
        </div>
        <div className="border-t border-line px-3 py-3">
          <Link href="/" target="_blank" className="flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm font-medium text-ink-600 transition hover:bg-paper-2 hover:text-ink-950">
            <Icon name="external" size={18} className="text-ink-400" />
            View live site
          </Link>
        </div>
      </aside>

      <div className="min-w-0">
        <Suspense fallback={<Main><PageSkeleton /></Main>}>
          <AdminGate>{children}</AdminGate>
        </Suspense>
      </div>
    </div>
  );
}

function Main({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">{children}</main>;
}

async function AdminGate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <Main>{children}</Main>;
}

const pendingReviews = cache(async () => {
  const supabase = await createClient();
  const { count } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .in("provider", ["instapay", "vodafone_cash"]);
  return { "/admin/payments": count ?? 0 };
});

/** Menu with a live count of payments waiting for review. */
async function AdminNavWithBadges() {
  return <AdminNav badges={await pendingReviews()} />;
}
async function MobileNavWithBadges() {
  return <MobileNav brand={brand} badges={await pendingReviews()} />;
}
