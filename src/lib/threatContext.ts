// Kept in step with the check constraints in
// 20260821000000_threat_context_limits.sql. The database is what actually
// enforces this — the per-location value is written straight from the
// browser through RLS — but the route and the form use the same number so a
// user hits a readable message instead of a constraint violation.
export const MAX_THREAT_CONTEXT_CHARS = 2000;
