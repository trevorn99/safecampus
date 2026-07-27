import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppHeader } from "@/components/AppHeader";
import { ORG_FILES_BUCKET } from "@/lib/supabase/storage";
import { TicketStatusSelect } from "./TicketStatusSelect";
import styles from "@/styles/ui.module.css";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

type TicketRow = {
  id: string;
  subject: string;
  message: string;
  status: string;
  attachment_paths: string[];
  created_at: string;
  organizations: { name: string } | { name: string }[] | null;
  members: { name: string } | { name: string }[] | null;
};

function firstOf<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function SupportTicketsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: isPlatformAdmin } = await supabase.rpc("is_platform_admin");
  if (!isPlatformAdmin) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();
  const { data: tickets } = await admin
    .from("support_tickets")
    .select("id, subject, message, status, attachment_paths, created_at, organizations(name), members(name)")
    .order("created_at", { ascending: false })
    .returns<TicketRow[]>();

  const ticketsWithLinks = await Promise.all(
    (tickets ?? []).map(async (ticket) => {
      let attachmentUrls: string[] = [];
      if (ticket.attachment_paths.length > 0) {
        const { data: signed } = await admin.storage
          .from(ORG_FILES_BUCKET)
          .createSignedUrls(ticket.attachment_paths, SIGNED_URL_TTL_SECONDS);
        attachmentUrls = (signed ?? []).map((entry) => entry.signedUrl).filter((url): url is string => Boolean(url));
      }
      return {
        ...ticket,
        organizationName: firstOf(ticket.organizations)?.name ?? "Unknown org",
        memberName: firstOf(ticket.members)?.name ?? "Unknown member",
        attachmentUrls,
      };
    }),
  );

  return (
    <>
      <AppHeader isAdmin={false} isPlatformAdmin />
      <main className={styles.appMain}>
        <div className={styles.pageHeading}>
          <h1 className={styles.pageTitle}>Support tickets</h1>
          <p className={styles.subtitle}>Every request across every organization</p>
        </div>

        <div className={styles.card}>
          {ticketsWithLinks.length === 0 && <p className={styles.helperText}>No support requests yet.</p>}
          <ul className={styles.list}>
            {ticketsWithLinks.map((ticket) => (
              <li key={ticket.id} className={styles.listRow}>
                <div>
                  <p className={styles.itemName}>{ticket.subject}</p>
                  <p className={styles.itemMeta}>
                    {ticket.organizationName} · {ticket.memberName} ·{" "}
                    {new Date(ticket.created_at).toLocaleString()}
                  </p>
                  <p className={styles.itemMeta}>{ticket.message}</p>
                  {ticket.attachmentUrls.length > 0 && (
                    <div className={styles.tagRow}>
                      {ticket.attachmentUrls.map((url, index) => (
                        <a
                          key={index}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className={`${styles.button} ${styles.buttonSecondary}`}
                        >
                          Screenshot {index + 1}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <TicketStatusSelect ticketId={ticket.id} status={ticket.status} />
              </li>
            ))}
          </ul>
        </div>

        <Link href="/platform-admin" className={`${styles.button} ${styles.buttonSecondary}`}>
          Back to all organizations
        </Link>
      </main>
    </>
  );
}
