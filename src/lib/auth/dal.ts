import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/**
 * Data Access Layer for auth. The secure (database-backed) check that backs the
 * optimistic gate in `proxy.ts`. Call these close to the data — in pages,
 * Server Actions, and Route Handlers — not just in a layout.
 *
 * `cache` memoizes the lookup for the duration of a single render pass so
 * multiple components can call getUser() without repeat round-trips.
 */
export const getUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Returns the signed-in user, or redirects to /login if there is none. */
export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
