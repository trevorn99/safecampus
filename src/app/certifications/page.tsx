import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { UploadCertificationForm } from "./UploadCertificationForm";
import { ORG_FILES_BUCKET } from "@/lib/supabase/storage";
import styles from "@/styles/ui.module.css";

type Cert = {
  id: string;
  type: string;
  issued_at: string | null;
  expires_at: string | null;
  document_id: string | null;
  member_id: string;
};

export default async function CertificationsPage() {
  const { supabase, member, organizationName, isAdmin } = await requireMembership();

  const { data: ownCerts } = await supabase
    .from("certifications")
    .select("id, type, issued_at, expires_at, document_id, member_id")
    .eq("member_id", member.id)
    .order("expires_at", { ascending: true });

  let allCerts: Cert[] = [];
  let memberNames = new Map<string, string>();
  if (isAdmin) {
    const [{ data: certs }, { data: members }] = await Promise.all([
      supabase
        .from("certifications")
        .select("id, type, issued_at, expires_at, document_id, member_id")
        .order("expires_at", { ascending: true }),
      supabase.from("members").select("id, name").eq("organization_id", member.organization_id),
    ]);
    allCerts = certs ?? [];
    memberNames = new Map((members ?? []).map((m) => [m.id, m.name]));
  }

  const documentIds = [
    ...new Set(
      [...(ownCerts ?? []), ...allCerts]
        .map((cert) => cert.document_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const { data: documents } = documentIds.length
    ? await supabase.from("documents").select("id, storage_path").in("id", documentIds)
    : { data: [] as { id: string; storage_path: string }[] };

  const signedUrls = new Map<string, string>();
  for (const doc of documents ?? []) {
    const { data } = await supabase.storage.from(ORG_FILES_BUCKET).createSignedUrl(doc.storage_path, 3600);
    if (data?.signedUrl) signedUrls.set(doc.id, data.signedUrl);
  }

  function renderCert(cert: Cert, showName: boolean) {
    return (
      <li key={cert.id} className={styles.listRow}>
        <div>
          <p className={styles.itemName}>
            {showName ? `${memberNames.get(cert.member_id) ?? "Unknown"} — ` : ""}
            {cert.type}
          </p>
          <p className={styles.itemMeta}>
            {cert.issued_at ? `Issued ${cert.issued_at}` : "Issue date not set"}
            {cert.expires_at ? ` · Expires ${cert.expires_at}` : ""}
          </p>
        </div>
        {cert.document_id && signedUrls.has(cert.document_id) && (
          <a
            href={signedUrls.get(cert.document_id)}
            target="_blank"
            rel="noreferrer"
            className={styles.link}
          >
            View file
          </a>
        )}
      </li>
    );
  }

  return (
    <>
      <AppHeader isAdmin={isAdmin} />
      <main className={styles.appMain}>
        <div className={styles.pageHeading}>
          <h1 className={styles.pageTitle}>Certifications</h1>
          <p className={styles.subtitle}>{organizationName}</p>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Your certifications</h2>
          </div>
          {(ownCerts ?? []).length === 0 && (
            <p className={styles.helperText}>Nothing on file yet.</p>
          )}
          <ul className={styles.list}>{(ownCerts ?? []).map((cert) => renderCert(cert, false))}</ul>
        </div>

        <UploadCertificationForm memberId={member.id} organizationId={member.organization_id} />

        {isAdmin && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>All team certifications</h2>
              <p className={styles.subtitle}>Admin view — every member&apos;s records.</p>
            </div>
            {allCerts.length === 0 && <p className={styles.helperText}>No certifications on file yet.</p>}
            <ul className={styles.list}>{allCerts.map((cert) => renderCert(cert, true))}</ul>
          </div>
        )}
      </main>
    </>
  );
}
