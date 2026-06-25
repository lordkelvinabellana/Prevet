import type { Metadata } from "next";
import { AssessForm } from "./assess-form";

export const metadata: Metadata = {
  title: "New assessment · Car Pre-Vetting Tool",
};

export default function AssessPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="mb-8 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Pre-vet a car</h1>
        <p className="text-muted-foreground">
          Enter a car&apos;s details for a deterministic max offer and a Buy /
          Pass / Check verdict, ready for human review.
        </p>
      </header>
      <AssessForm />
    </div>
  );
}
