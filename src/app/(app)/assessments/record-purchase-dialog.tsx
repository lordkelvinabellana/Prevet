"use client";

import { useState, useTransition } from "react";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { recordPurchase } from "./actions";

/** Popup to record (or edit) the actual purchase price + a note. */
export function RecordPurchaseDialog({
  assessmentId,
  triggerLabel = "Record purchase",
  triggerVariant = "default",
  defaultPrice,
  defaultNote,
}: {
  assessmentId: string;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost";
  defaultPrice?: number | null;
  defaultNote?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await recordPurchase(assessmentId, formData);
        setOpen(false);
      } catch {
        setError("Couldn't save. Check the price and try again.");
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm" variant={triggerVariant}>
          {triggerLabel}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95">
        <Dialog.Title className="text-lg font-semibold tracking-tight">
          Record purchase
        </Dialog.Title>
        <Dialog.Description className="mt-1 text-sm text-muted-foreground">
          Log the price paid to track spend and savings vs the asking price.
        </Dialog.Description>
        <form action={onSubmit} className="mt-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="price" className="text-sm font-medium">
              Price paid
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                id="price"
                name="price"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                required
                defaultValue={defaultPrice ?? ""}
                placeholder="22,000"
                aria-label="Purchase price"
                className="pl-7 font-mono tabular-nums"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="purchase-note" className="text-sm font-medium">
              Note <span className="text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              id="purchase-note"
              name="note"
              rows={2}
              defaultValue={defaultNote ?? ""}
              placeholder="e.g. negotiated down from asking…"
            />
          </div>
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
              {pending ? "Saving…" : "Save purchase"}
            </Button>
          </div>
        </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
