"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const SignupSchema = z
  .object({
    email: z.email("Enter a valid email address."),
    password: z.string().min(8, "Use at least 8 characters."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords don't match.",
    path: ["confirm"],
  });

export type SignupState = { error?: string; notice?: string } | undefined;

export async function signup(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const parsed = SignupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    const msg = (error.message ?? "").toLowerCase();
    if (
      error.status === 429 ||
      msg.includes("rate") ||
      msg.includes("seconds") ||
      msg.includes("security purposes")
    ) {
      return {
        error: "Too many sign-up attempts. Please wait a minute and try again.",
      };
    }
    if (msg.includes("already") || msg.includes("registered")) {
      return {
        error: "That email already has an account — try signing in instead.",
      };
    }
    return { error: "Couldn't create the account. Please try again." };
  }

  // Email confirmation OFF → a session is returned and the user is signed in.
  // Email confirmation ON → no session; the user must confirm via email first.
  if (data.session) {
    redirect("/");
  }
  return {
    notice:
      "Account created. Check your email to confirm it, then sign in.",
  };
}
