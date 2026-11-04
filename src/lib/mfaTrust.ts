// How long a device stays trusted after a successful MFA verification.
//
// Its own module because both sides need it: trustedDevice.ts (server-only)
// sets the cookie and row expiry from it, and the challenge page is a client
// component that has to offer exactly what the server will honour. Three
// copies of "30 days" in prose is how the text ends up disagreeing with the
// behaviour.
export const TRUST_DURATION_DAYS = 90;
