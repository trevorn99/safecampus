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

### Site URL must be right

These templates build their own link — `{{ .SiteURL }}/auth/confirm?…` — so
**Authentication → URL Configuration → Site URL** is what every sign-in link
points at, and a wrong value sends people to the wrong deployment or nowhere:

| Project | Site URL |
| --- | --- |
| production | `https://www.safecampus.net` |
| dev | `https://dev.safecampus.net` |

`{{ .SiteURL }}` is also where the logo is loaded from, so the dev project's
mail now shows the dev deployment rather than production's.

## Deliverability

These were rewritten after Proofpoint classified invitations as junk. What
mattered, in rough order: saying who invited the recipient and what
SafeCampus is rather than "you've been invited, click here"; a specific
call to action instead of a bare "Accept invitation"; naming the sender and
the organisation in the footer with guidance for someone who wasn't
expecting it; and a real plain-text alternative carrying the same content.

**The link's own hostname** was the other half. `{{ .ConfirmationURL }}`
points at `https://<project-ref>.supabase.co/auth/v1/verify?…`, so the
address under "Sign in to SafeCampus" was an unfamiliar domain with a
random-looking subdomain. These templates now build the link themselves from
`{{ .TokenHash }}` and send it to `/auth/confirm` on our own host, which
verifies the token server-side. Same credential, recognisable address.

One part still cannot be fixed from this repo. Supabase sends these over
SMTP, so SendGrid applies **account-level click tracking**, rewriting every
link to a `*.ct.sendgrid.net` redirect — which undoes the hostname fix
above. Turn it off in SendGrid under Settings > Tracking > Click Tracking,
or configure a branded link domain (`link.safecampus.net`) so the redirect
at least belongs to you.

Invitations are out of that blast radius already, since the app sends them
itself and `sendEmail` disables tracking per message. The sign-in link is
not: it goes through Supabase's SMTP, and it's the email every member gets
on every sign-in, so the account-level setting still matters.

## Notes

- **The logo URL comes from `{{ .SiteURL }}`.** Supabase renders these
  outside any request, so there is no request origin to derive it from, but
  the dashboard's Site URL is exactly the right value and is already needed
  for the link itself.
- **`{{ .Data.organization_name }}`** in `invite.html` comes from the
  `data` passed to `generateLink` in `src/lib/inviteEmail.ts`, which still
  writes it to the auth user even though the app's own invitation reads the
  organization name directly. It is wrapped in `{{ if }}` so an invite sent
  any other way still renders.
- **The links are one-shot**, here and before. `/auth/confirm` consumes the
  token, exactly as Supabase's verify endpoint did, so a mail client or
  security scanner that prefetches links will burn one. That is inherent to
  emailed credentials rather than something these templates introduced.
- **`confirm-signup.html`** is included for completeness. Sign-in is
  passwordless, so most accounts are created through the magic link or an
  invitation and never see it.
- Password reset and reauthentication templates are deliberately absent —
  there are no passwords in this app.
