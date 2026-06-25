"use client";

import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";

/** Scenario tokens recognised in the plate or VIN by the mock adapters. */
const TOKENS: { token: string; effect: string }[] = [
  { token: "STOLEN", effect: "History flags stolen → Pass" },
  { token: "WOVR", effect: "History flags written-off → Pass" },
  { token: "FINANCE", effect: "History flags finance owing → Check" },
  { token: "NOVAL", effect: "No valuation available → Check" },
  { token: "FAILVAL", effect: "Valuation service outage → error" },
  { token: "FAILHIST", effect: "History service outage → error" },
];

export function Guide() {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button variant="outline" size="sm">
          How to fill this in
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-background p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95">
          <Dialog.Title className="text-lg font-semibold tracking-tight">
            Filling in a car
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            This tool runs on mock RedBook and PPSR data. Results are
            deterministic — the same car always returns the same verdict.
          </Dialog.Description>

          <div className="mt-5 flex flex-col gap-5 text-sm">
            <section>
              <h3 className="mb-1 font-medium">What to enter</h3>
              <ul className="flex flex-col gap-1 text-muted-foreground">
                <li>
                  <span className="text-foreground">Plate or VIN</span> — at
                  least one. The mock valuation keys off whichever you give.
                </li>
                <li>
                  <span className="text-foreground">Year, make, model, km</span>{" "}
                  — drive the valuation; older / higher-km cars value lower.
                </li>
                <li>
                  <span className="text-foreground">Asking & repairs</span> —
                  compared against the max offer to decide Buy / Check / Pass.
                </li>
              </ul>
            </section>

            <section>
              <h3 className="mb-2 font-medium">Force a scenario</h3>
              <p className="mb-2 text-muted-foreground">
                Put any of these in the plate (or VIN) to demo a specific
                outcome:
              </p>
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-left">
                  <tbody>
                    {TOKENS.map((t, i) => (
                      <tr
                        key={t.token}
                        className={i > 0 ? "border-t border-border" : ""}
                      >
                        <td className="px-3 py-2 align-top">
                          <code className="font-mono text-xs">{t.token}</code>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {t.effect}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <p className="text-muted-foreground">
              In a hurry? Use a{" "}
              <span className="text-foreground">quick-fill</span> chip above to
              load and run a scenario in one click.
            </p>
          </div>

          <div className="mt-6 flex justify-end">
            <Dialog.Close asChild>
              <Button size="sm">Got it</Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
