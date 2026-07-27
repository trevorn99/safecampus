export const ORG_FILES_BUCKET = "org-files";

/** Path convention enforced by storage RLS: {organization_id}/{category}/... */
export function orgFilePath(organizationId: string, category: string, filename: string) {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${organizationId}/${category}/${crypto.randomUUID()}-${safeName}`;
}
