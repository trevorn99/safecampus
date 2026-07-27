import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ORG_FILES_BUCKET } from "@/lib/supabase/storage";

// Long-lived on purpose: avatars are rendered on nearly every roster/team
// view, and re-signing on every request would be wasteful. profile_picture_url
// stores a storage *path*, not a URL — org-files is a private bucket, so
// every read needs a fresh signed URL regardless of the column's name.
const AVATAR_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

// Storage RLS ("org members read their org files") is what actually scopes
// this to the caller's own org — passing the caller's own RLS-respecting
// client here (not the service-role client) means a member can never sign
// a URL for another organization's avatar, even if they somehow got a path.
export async function getAvatarUrlMap(
  supabase: SupabaseClient,
  paths: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const validPaths = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  if (validPaths.length === 0) return new Map();

  const { data } = await supabase.storage.from(ORG_FILES_BUCKET).createSignedUrls(validPaths, AVATAR_URL_TTL_SECONDS);

  const map = new Map<string, string>();
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) map.set(entry.path, entry.signedUrl);
  }
  return map;
}
