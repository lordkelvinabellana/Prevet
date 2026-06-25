import { createBrowserClient } from "@supabase/ssr";
import { supabasePublicEnv } from "./env";

/**
 * Browser Supabase client. Uses the ANON key only — never the service role key.
 * Safe to use in Client Components.
 */
export function createClient() {
  const { url, anonKey } = supabasePublicEnv();
  return createBrowserClient(url, anonKey);
}
