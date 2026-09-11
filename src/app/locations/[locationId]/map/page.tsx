import { notFound } from "next/navigation";
import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { ORG_FILES_BUCKET } from "@/lib/supabase/storage";
import { LocationMapPanel } from "../LocationMapPanel";
import styles from "@/styles/ui.module.css";

export default async function LocationMapPage({
  params,
}: {
  params: Promise<{ locationId: string }>;
}) {
  const { locationId } = await params;
  const { supabase, member, organizationName, isAdmin, isPlatformAdmin } = await requireMembership();

  const { data: location } = await supabase
    .from("locations")
    .select("id, name")
    .eq("id", locationId)
    .eq("organization_id", member.organization_id)
    .maybeSingle();

  if (!location) {
    notFound();
  }

  const { data: canManageLocation } = await supabase.rpc("is_location_manager", {
    target_location: locationId,
  });
  const canManage = isAdmin || Boolean(canManageLocation);

  const { data: map } = await supabase
    .from("maps")
    .select("id, storage_path")
    .eq("location_id", locationId)
    .maybeSingle();

  let imageUrl: string | null = null;
  if (map) {
    const { data } = await supabase.storage.from(ORG_FILES_BUCKET).createSignedUrl(map.storage_path, 3600);
    imageUrl = data?.signedUrl ?? null;
  }

  const { data: pins } = map
    ? await supabase.from("map_pins").select("id, x_pct, y_pct, post_id").eq("map_id", map.id)
    : { data: [] as { id: string; x_pct: number; y_pct: number; post_id: string }[] };

  // Pins target posts — the physical places at this location — rather than a
  // template's staffing requirement. The same door is one post however many
  // templates ask for somebody to stand at it.
  const { data: posts } = await supabase
    .from("location_posts")
    .select("id, name")
    .eq("location_id", locationId)
    .order("name");

  const postNames = new Map((posts ?? []).map((post) => [post.id, post.name]));
  const pinnedPostIds = new Set((pins ?? []).map((pin) => pin.post_id));
  const availablePositions = (posts ?? [])
    .filter((post) => !pinnedPostIds.has(post.id))
    .map((post) => ({ id: post.id, title: post.name, templateName: null }));

  return (
    <>
      <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
      <main className={styles.appMain}>
        <div className={styles.pageHeading}>
          <h1 className={styles.pageTitle}>{location.name} — Map</h1>
          <p className={styles.subtitle}>{organizationName}</p>
        </div>

        <LocationMapPanel
          organizationId={member.organization_id}
          locationId={locationId}
          canManage={canManage}
          map={map ? { id: map.id, imageUrl } : null}
          pins={(pins ?? []).map((pin) => ({
            id: pin.id,
            xPct: Number(pin.x_pct),
            yPct: Number(pin.y_pct),
            postId: pin.post_id,
            title: postNames.get(pin.post_id) ?? "Unknown post",
          }))}
          posts={posts ?? []}
          availablePositions={availablePositions}
        />

      </main>
    </>
  );
}
