import Link from "next/link";
import { getViewer } from "@/lib/auth/session";

/**
 * The account link in the homepage navigation. The homepage itself is cached, so this part is filled in
 * per visitor: signed-in students see "My exams" instead of a "Log in" that made them think they were
 * signed out (and sign in again every visit).
 */
export async function NavAccount({ mobile }: { mobile?: boolean }) {
  const viewer = await getViewer();
  if (!viewer) {
    return (
      <Link href="/sign-in" className={mobile ? "mnav-login" : "login"}>
        Log in
      </Link>
    );
  }
  if (mobile) {
    return (
      <>
        {viewer.role === "admin" ? <Link href="/admin">Admin</Link> : null}
        <Link href="/dashboard" className="mnav-login">
          My exams
        </Link>
      </>
    );
  }
  return (
    <>
      {viewer.role === "admin" ? (
        <Link href="/admin" className="login">
          Admin
        </Link>
      ) : null}
      <Link href="/dashboard" className="login">
        My exams
      </Link>
    </>
  );
}

/** Same size as the link, invisible, while the visitor's account is being checked. */
export function NavAccountPlaceholder({ mobile }: { mobile?: boolean }) {
  return (
    <span aria-hidden className={mobile ? "mnav-login" : "login"} style={{ visibility: "hidden" }}>
      Log in
    </span>
  );
}
