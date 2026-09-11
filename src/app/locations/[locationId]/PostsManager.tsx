"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/styles/ui.module.css";

// Posts are the physical places somebody stands at this location — a door, a
// camera desk, a corridor. They're deliberately separate from what an event
// asks of them: the Lobby door is one post however many services need it
// covered, and it carries one pin on the map.
export function PostsManager({
  organizationId,
  locationId,
  posts,
  pinnedPostIds,
  canManage,
  highlightedPostId,
  onHighlight,
}: {
  organizationId: string;
  locationId: string;
  posts: { id: string; name: string }[];
  pinnedPostIds: string[];
  canManage: boolean;
  highlightedPostId: string | null;
  onHighlight: (postId: string) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const pinned = new Set(pinnedPostIds);

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: insertError } = await supabase
      .from("location_posts")
      .insert({ organization_id: organizationId, location_id: locationId, name: name.trim() });

    setLoading(false);
    if (insertError) {
      // The unique index on (location_id, name) is what stops the duplicate
      // "Lobby" problem coming back by another route.
      setError(
        insertError.code === "23505" ? `There's already a post called "${name.trim()}" here.` : insertError.message,
      );
      return;
    }
    setName("");
    router.refresh();
  }

  async function remove(postId: string, postName: string) {
    if (!window.confirm(`Remove the "${postName}" post? Its map pin goes with it, and any staffing requirement pointing at it becomes unassigned to a place.`)) {
      return;
    }
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("location_posts").delete().eq("id", postId);
    setLoading(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    router.refresh();
  }

  return (
    <>
      {posts.length === 0 ? (
        <p className={styles.helperText}>
          No posts yet. Add the places people actually stand — a door, a corridor, a camera desk — then pin them on
          the map.
        </p>
      ) : (
        <ul className={styles.list}>
          {posts.map((post) => (
            <li key={post.id} className={styles.listRow}>
              {pinned.has(post.id) ? (
                // Only a pinned post has somewhere to flash to, so only that
                // one is clickable — an unpinned name that did nothing when
                // clicked would read as broken.
                <button
                  type="button"
                  className={styles.linkButton}
                  aria-pressed={highlightedPostId === post.id}
                  onClick={() => onHighlight(post.id)}
                >
                  {post.name}
                </button>
              ) : (
                <p className={styles.itemName}>{post.name}</p>
              )}
              <div className={styles.tagRow}>
                {pinned.has(post.id) ? (
                  <span className={styles.pill}>Show on map</span>
                ) : (
                  <span className={styles.pillMuted}>Not on the map</span>
                )}
                {canManage && (
                  <button
                    type="button"
                    className={`${styles.button} ${styles.buttonSecondary}`}
                    disabled={loading}
                    onClick={() => remove(post.id, post.name)}
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canManage && (
      <form onSubmit={add} className={styles.form}>
        <div className={styles.tagRow}>
          <input
            className={styles.input}
            placeholder="e.g. Main Lobby door"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={loading}
          />
          <button type="submit" className={`${styles.button} ${styles.buttonSecondary}`} disabled={loading}>
            {loading ? "Saving…" : "Add post"}
          </button>
        </div>
        {error && (
          <p className={styles.errorText} role="alert">
            {error}
          </p>
        )}
      </form>
      )}
    </>
  );
}
