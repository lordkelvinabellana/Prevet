import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublicEnv } from "./env";

/**
 * Server Supabase client bound to the request's cookies. RLS applies under the
 * signed-in user's identity. Uses the ANON key — the service role key is never
 * used here and must never reach the client.
 */
export async function createClient() {
  const { url, anonKey } = supabasePublicEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — cookie writes happen in middleware.
        }
      },
    },
  });
}
