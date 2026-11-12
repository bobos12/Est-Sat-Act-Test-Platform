import Link from "next/link";

/** The 16hundred mark: a filled answer bubble holding "16". Read with the wordmark: "16 hundred". */
export function LogoMark() {
  return <span className="mk" aria-hidden="true">16</span>;
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="logo" aria-label="16hundred home">
      <LogoMark />
      <span>hundred</span>
    </Link>
  );
}
