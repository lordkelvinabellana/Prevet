"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { deleteAssessment } from "./actions";

/**
 * Confirm-and-delete an assessment. `redirectAfter` is for the detail page (go
 * back to the list once the row is gone); in the table the revalidate refreshes
 * the list in place. `iconOnly` renders the compact per-row trash trigger.
 */
export function DeleteAssessmentDialog({
  assessmentId,
  redirectAfter = false,
  iconOnly = false,
  triggerClassName,
}: {
  assessmentId: string;
  redirectAfter?: boolean;
  iconOnly?: boolean;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteAssessment(assessmentId);
        setOpen(false);
        if (redirectAfter) router.push("/assessments");
      } catch {
        setError("Couldn't delete. Try again.");
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        {iconOnly ? (
          <button
            type="button"
            aria-label="Delete assessment"
            className={`relative z-10 grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${triggerClassName ?? ""}`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
              aria-hidden
            >
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
          </button>
        ) : (
          <Button variant="destructive" size="sm" className={triggerClassName}>
            Delete
          </Button>
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95">
          <Dialog.Title className="text-lg font-semibold tracking-tight">
            Delete this assessment?
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            This removes the car, its valuation and history check, and any photos.
            It can&apos;t be undone.
          </Dialog.Description>
          {error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-3">
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="sm">
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onConfirm}
              disabled={pending}
            >
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
