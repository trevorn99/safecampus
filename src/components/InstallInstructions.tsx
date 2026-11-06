import styles from "@/styles/ui.module.css";

// How to add SafeCampus to a phone's home screen. Shown on both Support and
// Help, from this one component so the two can't drift apart.
//
// The iPhone sign-in note is not optional detail: a home-screen web app on
// iOS keeps its own cookies, separate from Safari's, so someone signed in
// in Safari opens the new icon and is asked to sign in again. Told nothing,
// that reads as the app being broken. Typed sign-in codes make it painless
// — a link would have opened in Safari rather than the app.
export function InstallInstructions({ id }: { id?: string }) {
  return (
    <div id={id} className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Add SafeCampus to your phone&apos;s home screen</h2>
      </div>
      <p className={styles.docBody}>
        SafeCampus can sit on your home screen like an app. It opens full-screen, straight to{" "}
        <strong>Check in</strong>, with no app store download needed.
      </p>

      <h3 className={styles.itemName}>iPhone or iPad</h3>
      <ol className={styles.docBody}>
        <li>Open www.safecampus.net in Safari.</li>
        <li>
          Tap the <strong>Share</strong> button, the square with an arrow pointing up. On newer iPhones it can be under
          the <strong>•••</strong> menu.
        </li>
        <li>
          Scroll down, tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
        </li>
        <li>
          Open SafeCampus from the new icon and sign in once more. The home-screen app keeps its own sign-in, separate
          from Safari, so this is expected. After that it stays signed in.
        </li>
      </ol>
      <p className={styles.hint}>
        Chrome on iPhone works too: tap <strong>Share</strong> in the address bar, then{" "}
        <strong>Add to Home Screen</strong>.
      </p>

      <h3 className={styles.itemName}>Android</h3>
      <ol className={styles.docBody}>
        <li>Open www.safecampus.net in Chrome and sign in.</li>
        <li>
          Tap the <strong>⋮</strong> menu at the top right.
        </li>
        <li>
          Tap <strong>Add to Home screen</strong> or <strong>Install app</strong>, then <strong>Install</strong>.
        </li>
      </ol>
      <p className={styles.hint}>
        On a Samsung phone using Samsung Internet: tap the <strong>☰</strong> menu, then{" "}
        <strong>Add page to → Home screen</strong>.
      </p>
    </div>
  );
}
