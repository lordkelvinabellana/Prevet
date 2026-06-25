import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { Button } from "@/components/ui/button";
import { logout } from "./actions";

/**
 * Layout for the authenticated area. Gates every route in the (app) group:
 * `requireUser()` redirects to /login when there is no session. This is the
 * secure (DB-backed) check; `proxy.ts` does the optimistic redirect.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Car Pre-Vetting Tool
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{user.email}</span>
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
