import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// The wall-clock timezone event/position times should be read and written
// in: a specific location's, falling back to the org's default. Shared by
// every server component that displays or resolves a default for
// schedule-related times — see src/lib/eventSeries.ts for the same rule
// applied to recurring-series generation.
export async function resolveTimeZone(
  supabase: SupabaseClient,
  organizationId: string,
  locationId: string | null,
): Promise<string> {
  if (locationId) {
    const { data: location } = await supabase.from("locations").select("timezone").eq("id", locationId).maybeSingle();
    if (location?.timezone) return location.timezone;
  }
  const { data: organization } = await supabase
    .from("organizations")
    .select("timezone")
    .eq("id", organizationId)
    .single();
  return organization?.timezone ?? "UTC";
}
