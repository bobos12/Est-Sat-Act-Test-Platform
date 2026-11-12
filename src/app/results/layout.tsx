import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";

export default function ResultsLayout({ children }: LayoutProps<"/results">) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
