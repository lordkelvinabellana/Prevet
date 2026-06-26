import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "car-photos";
const TTL_SECONDS = 3600;

/**
 * Batch-sign storage object paths from the private `car-photos` bucket into a
 * `{ path → signed URL }` map. Called from server components with the user's
 * RLS-scoped client, so it only signs paths the user owns; anything else is
 * silently skipped. Photos are never public — these URLs expire.
 */
export async function signPhotoUrls(
  supabase: SupabaseClient,
  paths: string[],
): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return {};
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(unique, TTL_SECONDS);
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) map[row.path] = row.signedUrl;
  }
  return map;
}
