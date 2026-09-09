import styles from "@/styles/ui.module.css";

// Root Suspense fallback for every route. Beyond showing that a click
// registered, this is what makes <Link> prefetching worth anything here:
// every route in this app is dynamic, and Next only prefetches a dynamic
// route down to its nearest loading boundary — without this file there was
// no boundary to prefetch to.
export default function Loading() {
  return (
    <>
      <div className={styles.skeletonHeader} />
      <main className={styles.appMain} aria-busy="true" aria-label="Loading">
        <div>
          <div className={styles.skeletonTitle} />
          <div className={styles.skeletonSubtitle} />
        </div>
        <div className={styles.skeletonCard} />
        <div className={styles.skeletonCard} />
      </main>
    </>
  );
}
