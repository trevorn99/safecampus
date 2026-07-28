import { redirect } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { createAdminClient } from "@/lib/supabase/admin";
import { CredentialsForm } from "./CredentialsForm";
import { ImportButton } from "./ImportButton";
import { DisconnectButton } from "./DisconnectButton";
import styles from "@/styles/ui.module.css";

const ERROR_MESSAGE: Record<string, string> = {
  missing_state: "The connection attempt expired — try again.",
  invalid_state: "The connection attempt expired — try again.",
  state_mismatch: "The connection attempt couldn't be verified — try again.",
  not_a_member: "That account isn't a member of this organization.",
  token_exchange_failed: "Planning Center rejected the connection — try again.",
  no_credentials: "Save your Planning Center client ID and secret first.",
};

export default async function PlanningCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { connected, error } = await searchParams;
  const { supabase, member, organizationName, isAdmin, isPlatformAdmin } = await requireMembership();

  if (!isAdmin) {
    redirect("/schedule");
  }

  const headersList = await headers();
  const callbackUrl = `https://${headersList.get("host")}/api/integrations/planning-center/callback`;

  const { data: org } = await supabase
    .from("organizations")
    .select("pco_connected")
    .eq("id", member.organization_id)
    .single();

  // pco_app_credentials has zero client RLS policies by design (the secret
  // must never be reachable from the browser) — this read only ever runs
  // server-side, and only ever selects client_id, never the secret.
  const admin = createAdminClient();
  const { data: credentials } = await admin
    .from("pco_app_credentials")
    .select("client_id")
    .eq("organization_id", member.organization_id)
    .maybeSingle();

  type Candidate = { id: string; title: string; starts_at: string };
  type Promoted = { id: string; title: string; starts_at: string; promoted_event_id: string; events: { title: string } | { title: string }[] | null };

  const [{ data: candidates }, { data: promoted }] = org?.pco_connected
    ? await Promise.all([
        supabase
          .from("pco_imported_events")
          .select("id, title, starts_at")
          .eq("organization_id", member.organization_id)
          .is("promoted_event_id", null)
          .order("starts_at")
          .returns<Candidate[]>(),
        supabase
          .from("pco_imported_events")
          .select("id, title, starts_at, promoted_event_id, events(title)")
          .eq("organization_id", member.organization_id)
          .not("promoted_event_id", "is", null)
          .order("starts_at")
          .returns<Promoted[]>(),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <>
      <AppHeader isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin} />
      <main className={styles.appMain}>
        <div className={styles.pageHeading}>
          <h1 className={styles.pageTitle}>Planning Center</h1>
          <p className={styles.subtitle}>{organizationName}</p>
        </div>

        {connected && <p className={styles.helperText}>Connected to Planning Center.</p>}
        {error && <p className={styles.errorText}>{ERROR_MESSAGE[error] ?? "Something went wrong."}</p>}

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>
              {org?.pco_connected ? "Connected" : credentials ? "Not connected" : "Set up your Planning Center app"}
            </h2>
            <p className={styles.helperText}>
              Check for upcoming events from your Planning Center calendar. Nothing is created here
              automatically — you choose which ones need a safety team presence.
            </p>
          </div>

          {!credentials && (
            <>
              <p className={styles.helperText}>
                Each organization connects its own Planning Center OAuth app — this keeps your access
                independently manageable from your own Planning Center account. While logged into your
                Planning Center account, create one at{" "}
                <strong>api.planningcenteronline.com/oauth/applications</strong> (&quot;Register one now&quot;),
                and register this exact redirect URI:
              </p>
              <p className={styles.itemMeta}>
                <code>{callbackUrl}</code>
              </p>
              <CredentialsForm existingClientId={null} />
            </>
          )}

          {credentials && !org?.pco_connected && (
            <>
              <div className={styles.actions}>
                <a
                  href="/api/integrations/planning-center/connect"
                  className={`${styles.button} ${styles.buttonPrimary}`}
                >
                  Connect Planning Center
                </a>
              </div>
              <details>
                <summary className={styles.link}>Update app credentials</summary>
                <CredentialsForm existingClientId={credentials.client_id} />
              </details>
            </>
          )}

          {org?.pco_connected && (
            <div className={styles.actions}>
              <ImportButton />
              <DisconnectButton />
            </div>
          )}
        </div>

        {org?.pco_connected && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Available to create as events</h2>
            </div>
            {(candidates ?? []).length === 0 && (
              <p className={styles.helperText}>Nothing waiting — check for new events above.</p>
            )}
            <ul className={styles.list}>
              {(candidates ?? []).map((candidate) => (
                <li key={candidate.id} className={styles.listRow}>
                  <div>
                    <p className={styles.itemName}>{candidate.title}</p>
                    <p className={styles.itemMeta}>{new Date(candidate.starts_at).toLocaleString()}</p>
                  </div>
                  <Link
                    href={`/schedule/new?fromPco=${candidate.id}`}
                    className={`${styles.button} ${styles.buttonSecondary}`}
                  >
                    Create event
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {org?.pco_connected && (promoted ?? []).length > 0 && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Already created</h2>
            </div>
            <ul className={styles.list}>
              {(promoted ?? []).map((row) => {
                const eventTitle = Array.isArray(row.events) ? row.events[0]?.title : row.events?.title;
                return (
                  <li key={row.id} className={styles.listRow}>
                    <div>
                      <p className={styles.itemName}>{eventTitle ?? row.title}</p>
                      <p className={styles.itemMeta}>{new Date(row.starts_at).toLocaleString()}</p>
                    </div>
                    <Link href={`/schedule/${row.promoted_event_id}`} className={styles.link}>
                      View event
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <Link href="/schedule" className={styles.link}>
          ← Back to schedule
        </Link>
      </main>
    </>
  );
}
