"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/assess", label: "New assessment" },
  { href: "/assessments", label: "Assessments" },
];

/** Primary nav for the authenticated area, with active-route highlighting. */
export function MainNav() {
  const pathname = usePathname();
  return (
    <nav className="flex min-w-0 items-center gap-1 overflow-x-auto">
      {LINKS.map((l) => {
        const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-md px-2.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
