"use client";

import { useState, useTransition } from "react";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { markReviewed } from "./actions";

/** Popup to mark an assessment reviewed with an optional note. */
export function MarkReviewedDialog({ assessmentId }: { assessmentId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await markReviewed(assessmentId, formData);
        setOpen(false);
      } catch {
        setError("Couldn't mark reviewed. Try again.");
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm" variant="outline">
          Mark reviewed
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95">
          <Dialog.Title className="text-lg font-semibold tracking-tight">
            Mark reviewed
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            Confirm you&apos;ve checked this assessment. Add a note for the record
            if you like.
          </Dialog.Description>
          <form action={onSubmit} className="mt-5 flex flex-col gap-4">
            <Textarea
              name="note"
              rows={3}
              placeholder="Note (optional)…"
              aria-label="Reviewer note"
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="mt-1 flex justify-end gap-3">
              <Dialog.Close asChild>
                <Button type="button" variant="ghost" size="sm">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Saving…" : "Confirm reviewed"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
