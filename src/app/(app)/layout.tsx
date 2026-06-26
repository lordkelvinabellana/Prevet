import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { Button } from "@/components/ui/button";
import { MainNav } from "./main-nav";
import { ThemeToggle } from "./theme-toggle";
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
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
              C
            </span>
            <span className="hidden text-sm font-semibold tracking-tight sm:inline">
              Car Pre-Vetting
            </span>
          </Link>
          <span
            className="mx-1 hidden h-5 w-px bg-border sm:block"
            aria-hidden
          />
          <MainNav />
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <span className="hidden text-sm text-muted-foreground md:inline">
              {user.email}
            </span>
            <form action={logout}>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
