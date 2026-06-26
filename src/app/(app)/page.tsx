import Link from "next/link";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    n: "1",
    title: "Enter the car",
    body: "Plate or VIN, make, model, kilometres, the asking price, and your repair estimate.",
  },
  {
    n: "2",
    title: "Get a max offer",
    body: "A deterministic engine returns the most you should pay and a Buy / Pass / Check verdict — no AI guesswork.",
  },
  {
    n: "3",
    title: "Check & review",
    body: "Run a PPSR history check only when it's worth it, then mark the verdict reviewed.",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-12 px-4 py-12 sm:px-6 sm:py-16">
      <div className="flex flex-col gap-5">
        <span className="text-[0.7rem] font-medium uppercase tracking-widest text-muted-foreground">
          CarWow WA · pre-vetting
        </span>
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Decide what a car is worth — before you buy it.
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Enter a car and get a defensible max offer with a Buy / Pass / Check
          verdict, ready for human review.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <Button asChild size="lg">
            <Link href="/assess">New assessment</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/assessments">View assessments</Link>
          </Button>
        </div>
      </div>

      <ol className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((s) => (
          <li
            key={s.n}
            className="flex flex-col gap-2 rounded-xl border border-border p-5"
          >
            <span className="grid size-7 place-items-center rounded-md bg-muted font-mono text-sm font-semibold">
              {s.n}
            </span>
            <h2 className="font-medium">{s.title}</h2>
            <p className="text-sm text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
