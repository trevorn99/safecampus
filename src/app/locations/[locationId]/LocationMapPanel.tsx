"use client";

import { useState } from "react";
import { PostsManager } from "./PostsManager";
import { MapEditor } from "./map/MapEditor";
import styles from "@/styles/ui.module.css";

// Holds the one piece of state the posts list and the map both need: which
// post is being pointed at. They're siblings, so it has to live above them —
// and a client wrapper is cheaper than threading it through the URL, since
// nothing about a momentary highlight is worth a navigation.
export function LocationMapPanel({
  organizationId,
  locationId,
  canManage,
  map,
  maps,
  pins,
  posts,
  availablePositions,
}: {
  organizationId: string;
  locationId: string;
  canManage: boolean;
  map: { id: string; name: string; imageUrl: string | null } | null;
  maps: { id: string; name: string }[];
  pins: { id: string; xPct: number; yPct: number; title: string; postId: string }[];
  posts: { id: string; name: string }[];
  availablePositions: { id: string; title: string; templateName: string | null }[];
}) {
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);

  // Re-clicking the same post should flash again rather than do nothing, and
  // the animation only restarts if the class is removed first — so the id is
  // cleared for a frame before being set back.
  function highlight(postId: string) {
    setHighlightedPostId(null);
    requestAnimationFrame(() => setHighlightedPostId(postId));
  }

  return (
    <>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Posts</h2>
          <p className={styles.helperText}>
            The places people actually stand at this location. A post exists once however many events need it
            covered, carries one pin on the map, and is what a staffing requirement points at when it&apos;s a fixed
            place — things like &ldquo;Roam&rdquo; don&apos;t need one. Click a pinned post to find it on the map.
          </p>
        </div>
        <PostsManager
          organizationId={organizationId}
          locationId={locationId}
          posts={posts}
          pinnedPostIds={pins.map((pin) => pin.postId)}
          canManage={canManage}
          highlightedPostId={highlightedPostId}
          onHighlight={highlight}
        />
      </div>

      <MapEditor
        organizationId={organizationId}
        locationId={locationId}
        canManage={canManage}
        map={map}
        maps={maps}
        pins={pins}
        availablePositions={availablePositions}
        highlightedPostId={highlightedPostId}
      />
    </>
  );
}
