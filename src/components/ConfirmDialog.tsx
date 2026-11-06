"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import styles from "@/styles/ui.module.css";

// The app's confirmation dialog, replacing window.confirm.
//
// The browser's own box was plain, unstyled, headed "www.safecampus.net
// says", offered only OK and Cancel, and on a phone looked like a system
// warning. This one says what's being confirmed, names the action on its
// button ("Delete team", not "OK"), and marks destructive ones in red.
//
// Built on <dialog> with showModal(), which gives a real modal for free:
// focus stays inside it, the page behind is inert, and Escape closes it.
// Escape, Cancel and clicking the backdrop all answer no.

export type ConfirmOptions = {
  /** The question, e.g. "Delete Level 1?" */
  title: string;
  /** What happens if they go ahead. Line breaks are kept. */
  message?: string;
  /** The action itself — "Delete team", never "OK". */
  confirmLabel: string;
  cancelLabel?: string;
  /** Red confirm button, and focus starts on Cancel so Enter can't destroy. */
  tone?: "danger" | "default";
};

type Pending = ConfirmOptions & { resolve: (confirmed: boolean) => void };
type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  // The live request, outside state: resolving a promise is a side effect
  // and doesn't belong in a state updater, which React may run twice.
  const pendingRef = useRef<Pending | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const confirm = useCallback<Confirm>(
    (options) =>
      new Promise<boolean>((resolve) => {
        // A second request while one is open answers the first with no.
        pendingRef.current?.resolve(false);
        const next = { ...options, resolve };
        pendingRef.current = next;
        setPending(next);
      }),
    [],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!pending || !dialog) return;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLButtonElement>("[data-initial-focus]")?.focus();
  }, [pending]);

  const finish = useCallback((confirmed: boolean) => {
    const current = pendingRef.current;
    pendingRef.current = null;
    if (dialogRef.current?.open) dialogRef.current.close();
    setPending(null);
    current?.resolve(confirmed);
  }, []);

  const danger = pending?.tone === "danger";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <dialog
        ref={dialogRef}
        className={styles.confirmDialog}
        aria-labelledby="confirm-dialog-title"
        aria-describedby={pending?.message ? "confirm-dialog-message" : undefined}
        // Escape closes the dialog natively; anything still pending then is a no.
        onClose={() => {
          if (pendingRef.current) finish(false);
        }}
        // A click on the dialog element itself, rather than its contents, is
        // a click on the backdrop.
        onClick={(event) => {
          if (event.target === event.currentTarget) finish(false);
        }}
      >
        {pending && (
          <div className={styles.confirmBody}>
            <h2 id="confirm-dialog-title" className={styles.confirmTitle}>
              {pending.title}
            </h2>
            {pending.message && (
              <p id="confirm-dialog-message" className={styles.confirmMessage}>
                {pending.message}
              </p>
            )}
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonSecondary}`}
                data-initial-focus={danger ? "" : undefined}
                onClick={() => finish(false)}
              >
                {pending.cancelLabel ?? "Cancel"}
              </button>
              <button
                type="button"
                className={`${styles.button} ${danger ? styles.buttonDanger : styles.buttonPrimary}`}
                data-initial-focus={danger ? undefined : ""}
                onClick={() => finish(true)}
              >
                {pending.confirmLabel}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </ConfirmContext.Provider>
  );
}

/** `if (!(await confirm({ ... }))) return;` — the drop-in for window.confirm. */
export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside <ConfirmProvider>, which the root layout provides.");
  return confirm;
}
