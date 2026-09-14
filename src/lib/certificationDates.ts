// issued_at and expires_at are `date` columns: "YYYY-MM-DD", no time, no
// zone. Passing that to new Date() parses it as UTC midnight, which renders
// as the previous day for anyone west of Greenwich — so the parts are
// formatted directly, and compared as strings, which is the same comparison
// without inventing a timezone for a value that hasn't got one.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDateOnly(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

export type ExpiryState = "none" | "expired" | "soon" | "valid";

export function expiryState(expiresAt: string | null, today: string, soon: string): ExpiryState {
  if (!expiresAt) return "none";
  if (expiresAt < today) return "expired";
  return expiresAt <= soon ? "soon" : "valid";
}
