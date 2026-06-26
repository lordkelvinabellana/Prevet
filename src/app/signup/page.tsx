import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Create account · Car Pre-Vetting Tool",
};

export default function SignupPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-16">
      <div className="w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-3">
          <span className="grid size-8 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            C
          </span>
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold tracking-tight">
              Create your account
            </h1>
            <p className="text-sm text-muted-foreground">
              Car Pre-Vetting Tool — start pre-vetting cars.
            </p>
          </div>
        </div>
        <SignupForm />
        <p className="mt-4 text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
