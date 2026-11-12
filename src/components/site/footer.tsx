import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { cacheLife } from "next/cache";
import { brand } from "@/lib/brand";

const columns = [
  {
    title: "Practice",
    links: [
      { href: "/exams?track=est", label: "EST" },
      { href: "/exams?track=sat", label: "SAT" },
      { href: "/exams?track=act", label: "ACT" },
      { href: "/exams?access=free", label: "Free exams" },
    ],
  },
  {
    title: "Platform",
    links: [
      { href: "/exams", label: "Exam library" },
      { href: "/pricing", label: "Pricing" },
      { href: "/#contact", label: "Contact" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/sign-up", label: "Create account" },
      { href: "/sign-in", label: "Sign in" },
      { href: `mailto:${brand.supportEmail}`, label: "Support" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-paper-2/60">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-ink-600">{brand.description}</p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">{col.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-ink-700 hover:text-ink-950">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-xs text-ink-500 sm:flex-row sm:justify-between sm:px-6">
          <p>
            © <CopyrightYear /> {brand.name}. All rights reserved.
          </p>
          <p>{brand.name} is an independent preparation platform and is not affiliated with or endorsed by the EST, SAT or ACT organisers. SAT® is a trademark of the College Board; ACT® is a trademark of ACT, Inc.</p>
        </div>
      </div>
    </footer>
  );
}

async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}
