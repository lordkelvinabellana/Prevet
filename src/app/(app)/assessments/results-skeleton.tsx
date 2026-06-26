import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback for the keyed <Suspense> around the results region — shown on every
 * filter / sort / search while the new rows load (a transition would otherwise
 * keep the stale table on screen with no feedback). Mirrors the real layout:
 * a desktop table outline and mobile card rows.
 */
export function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <Skeleton className="h-5 w-32" /> {/* the "N of M" count line */}

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <div className="flex items-center gap-4 border-b border-border bg-muted/40 px-3 py-2.5">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-3 py-3">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="size-9 shrink-0 rounded-md" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border md:hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-6 w-14 shrink-0 rounded-full" />
            <Skeleton className="size-10 shrink-0 rounded-md" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-4 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
