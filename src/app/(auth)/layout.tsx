import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-6 py-6">
        <Link href="/" aria-label="16hundred home">
          <Logo />
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-6 pb-16 pt-8 sm:pt-16">
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
    </div>
  );
}
