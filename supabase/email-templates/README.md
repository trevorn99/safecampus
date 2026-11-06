# Auth email templates

Supabase Auth sends the sign-in link and the signup confirmation — not this
app — so those templates can't come from `src/lib/email.ts` like the shift
reminder does. They live here as the source of truth, and are **pasted into
each Supabase project's dashboard by hand**.

Invitations are no longer among them. The app mints the link with
`generateLink` and sends the mail itself through `src/lib/inviteEmail.ts`,
so a first invitation and a resend are byte-identical. `invite.html` is kept
only for an invite sent from the Supabase dashboard by hand, which bypasses
the app entirely; pasting it is optional, and nothing a member receives
through SafeCampus depends on it.

They are a deliberate copy of `renderBrandedEmail()` in `src/lib/email.ts`.
Changing the look in one place means changing it in the other; there is no
build step that keeps them in sync, because the dashboard is on the far
side of a process boundary.

## Applying them

Supabase dashboard → Authentication → Emails → Templates, once per project
(dev and prod are separate databases with separate template settings):

| File | Template | Needed? |
| --- | --- | --- |
| `magic-link.html` | Magic Link | **Yes** — every sign-in uses it |
| `confirm-signup.html` | Confirm signup | Rarely reached, paste for completeness |
| `invite.html` | Invite user | Optional — dashboard-initiated invites only |

Paste the file's whole contents into the message body. Subjects are set
separately in the same screen; the app doesn't control them.

## Deliverability

These were rewritten after Proofpoint classified invitations as junk. What
mattered, in rough order: saying who invited the recipient and what
SafeCampus is rather than "you've been invited, click here"; a specific
call to action instead of a bare "Accept invitation"; naming the sender and
the organisation in the footer with guidance for someone who wasn't
expecting it; and a real plain-text alternative carrying the same content.

One part cannot be fixed from this repo. Supabase sends these over SMTP, so
SendGrid applies **account-level click tracking**, rewriting every link to a
`*.ct.sendgrid.net` redirect — an unrecognisable domain under a sign-in
button, which is exactly what filters weigh. Turn it off in SendGrid under
Settings > Tracking > Click Tracking, or configure a branded link domain
(`link.safecampus.net`) so the redirect at least belongs to you.

Moving invitations into the app took them out of that blast radius, since
`sendEmail` disables tracking per message — but the sign-in link still goes
through Supabase's SMTP, and that's the email every member gets on every
sign-in, so the account-level setting still matters.

## Notes

- **The logo URL is absolute** (`https://safecampus.net/images/logo-mark.png`)
  and hardcoded. Supabase renders these outside any request, so there is no
  origin to derive it from — which also means a dev-project invite shows the
  production logo. That's fine, and better than a broken image.
- **`{{ .Data.organization_name }}`** in `invite.html` comes from the
  `data` passed to `generateLink` in `src/lib/inviteEmail.ts`, which still
  writes it to the auth user even though the app's own invitation reads the
  organization name directly. It is wrapped in `{{ if }}` so an invite sent
  any other way still renders.
- **`confirm-signup.html`** is included for completeness. Sign-in is
  passwordless, so most accounts are created through the magic link or an
  invitation and never see it.
- Password reset and reauthentication templates are deliberately absent —
  there are no passwords in this app.
