import "server-only";

// Vercel Cron sends `Authorization: Bearer $CRON_SECRET` on every scheduled
// call once that var is set on the project. Cron routes are public URLs with
// no session, and each one runs the service-role client, so this header is
// the only thing standing between a stranger and every org's data.
//
// The explicit unset check is the point of putting this in one place: the
// obvious `authHeader !== \`Bearer ${process.env.CRON_SECRET}\`` interpolates
// to the literal "Bearer undefined" on any environment missing the var —
// a string anyone can simply send. Missing secret means no one gets in.
export function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
