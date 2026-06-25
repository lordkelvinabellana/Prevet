import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Pre-vet a car
        </h1>
        <p className="max-w-prose text-muted-foreground">
          Enter a car&apos;s details to get a deterministic max offer and a
          Buy / Pass / Check recommendation, ready for human review.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild size="lg">
          <Link href="/assess">New assessment</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/assessments">View assessments</Link>
        </Button>
      </div>
    </div>
  );
}
