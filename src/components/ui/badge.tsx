import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Minimal badge. Colour comes from the caller (e.g. the verdict pill classes in
 * the assessments _shared module), so this stays a neutral, reusable shell.
 */
function Badge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium",
        className,
      )}
      {...props}
    />
  )
}

export { Badge }
