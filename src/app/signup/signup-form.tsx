"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signup, type SignupState } from "./actions";

export function SignupForm() {
  const [state, action, pending] = useActionState<SignupState, FormData>(
    signup,
    undefined,
  );

  // Once the account is created (confirmation required), show the notice instead
  // of the form so the user doesn't resubmit.
  if (state?.notice) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-lg border border-emerald-600/30 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-950/30 dark:text-emerald-300">
          {state.notice}
        </p>
        <Button asChild size="lg" variant="outline">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@carwow.com.au"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm" className="text-sm font-medium">
          Confirm password
        </label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending} className="mt-2">
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
