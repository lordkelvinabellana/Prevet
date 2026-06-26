/** A car photo thumbnail (signed URL) with a neutral placeholder when absent. */
export function CarThumb({
  url,
  className = "size-10",
}: {
  url?: string | null;
  className?: string;
}) {
  return (
    <div
      className={`${className} shrink-0 overflow-hidden rounded-md border border-border bg-muted`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          loading="lazy"
          className="size-full object-cover"
        />
      ) : (
        <div
          className="grid size-full place-items-center text-muted-foreground/60"
          aria-hidden
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="size-4"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
        </div>
      )}
    </div>
  );
}
