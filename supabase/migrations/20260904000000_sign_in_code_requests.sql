-- Ledger of sign-in code requests, for rate limiting /api/auth/send-code.
--
-- Codes used to be sent by Supabase Auth's signInWithOtp, which rate-limits
-- on its own. They are now minted with the admin generateLink and mailed by
-- the app over SendGrid — the same pipe as invitations, which is the one
-- that reliably delivers — and admin calls bypass Supabase's limits. Without
-- this, the route would mail a code to any address, as often as asked: a
-- way to flood someone's inbox from our domain, and to spend our SendGrid
-- reputation doing it.
--
-- Neither column holds the raw value. The route stores SHA-256 hashes of
-- the normalized address and of the client IP, which is enough to count
-- requests and useless for anything else.
create table sign_in_code_requests (
  id bigint generated always as identity primary key,
  email_hash text not null,
  ip_hash text not null,
  requested_at timestamptz not null default now()
);

create index sign_in_code_requests_email_idx on sign_in_code_requests (email_hash, requested_at);
create index sign_in_code_requests_ip_idx on sign_in_code_requests (ip_hash, requested_at);
-- For pruning: rows older than the longest window are dead weight.
create index sign_in_code_requests_time_idx on sign_in_code_requests (requested_at);

-- Service-role only. RLS on with no policies means no client can read or
-- write it, signed in or not.
alter table sign_in_code_requests enable row level security;
