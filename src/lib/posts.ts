import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostOption } from "@/components/PostSelect";

// Every post in the organization, labelled with its location. Not filtered to
// one location on purpose: a template can be used at more than one campus, so
// restricting the list would hide valid choices. The location name in each
// option is what keeps two campuses' Lobby doors apart.
export async function listPostOptions(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<PostOption[]> {
  const { data } = await supabase
    .from("location_posts")
    .select("id, name, locations(name)")
    .eq("organization_id", organizationId)
    .order("name")
    .returns<{ id: string; name: string; locations: { name: string } | null }[]>();

  return (data ?? [])
    .map((post) => ({
      id: post.id,
      name: post.name,
      locationName: post.locations?.name ?? "Unknown location",
    }))
    .sort((a, b) => a.locationName.localeCompare(b.locationName) || a.name.localeCompare(b.name));
}
