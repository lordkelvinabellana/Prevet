"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

const VERDICTS = [
  { value: "buy", label: "Buy" },
  { value: "check", label: "Check" },
  { value: "pass", label: "Pass" },
];
const STATUSES = [
  { value: "needs_ppsr", label: "Needs PPSR" },
  { value: "needs_review", label: "Needs review" },
  { value: "purchased", label: "Purchased" },
];

function chipClass(active: boolean): string {
  return `inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
    active
      ? "border-transparent bg-primary text-primary-foreground"
      : "border-border bg-background hover:bg-muted"
  }`;
}

/** Search + filter controls. Drives the page via URL search params. */
export function AssessmentsToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [, startTransition] = useTransition();

  function replace(sp: URLSearchParams) {
    startTransition(() =>
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false }),
    );
  }

  // Debounce the search box into the URL.
  useEffect(() => {
    const handle = setTimeout(() => {
      const current = params.get("q") ?? "";
      if (q.trim() === current) return;
      const sp = new URLSearchParams(params.toString());
      if (q.trim()) sp.set("q", q.trim());
      else sp.delete("q");
      replace(sp);
    }, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function toggle(key: string, value: string) {
    const sp = new URLSearchParams(params.toString());
    if (sp.get(key) === value) sp.delete(key);
    else sp.set(key, value);
    replace(sp);
  }

  const activeVerdict = params.get("verdict");
  const activeStatus = params.get("status");

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search plate, make, or model…"
        aria-label="Search assessments"
        className="sm:max-w-xs"
      />
      <div className="flex flex-wrap items-center gap-2">
        {VERDICTS.map((v) => (
          <button
            key={v.value}
            type="button"
            onClick={() => toggle("verdict", v.value)}
            aria-pressed={activeVerdict === v.value}
            className={chipClass(activeVerdict === v.value)}
          >
            {v.label}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        {STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => toggle("status", s.value)}
            aria-pressed={activeStatus === s.value}
            className={chipClass(activeStatus === s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
