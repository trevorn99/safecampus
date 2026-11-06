# Auth email templates

Supabase Auth sends the sign-in code and the signup confirmation code — not
this app — so those templates can't come from `src/lib/email.ts` like the
shift reminder does. They live here as the source of truth, and are
**pasted into each Supabase project's dashboard by hand**.

Invitations are not among them. The app sends those itself through
`src/lib/inviteEmail.ts`. `invite.html` is kept only for an invite sent from
the Supabase dashboard by hand, which bypasses the app entirely.

They are a deliberate copy of `renderBrandedEmail()` in `src/lib/email.ts`,
and the code box matches `codeBlockHtml()` in `src/lib/inviteEmail.ts`.
Changing the look in one place means changing it in the others; there is no
build step that keeps them in sync, because the dashboard is on the far side
of a process boundary.

## Codes, not links

Sign-in is a 6-digit code the person types on `/login`. Emailed links were
single-use credentials, and mail filters such as Proofpoint open every link
in a message to inspect it, so a link could be spent before its recipient
clicked it. A code has to be read and typed by a person.

That only works if **the email contains no link carrying the same
credential**. A sign-in link and a code are the same one-time token, so a
scanner opening the link spends the code too. These templates show
`{{ .Token }}` as text and use neither `{{ .ConfirmationURL }}` nor
`{{ .TokenHash }}`. Don't add either back.

`{{ .Token }}` is display text, never an `href`. `<a href="{{ .Token }}">`
renders as `<a href="482913">` — a link to a page named after the code,
which goes nowhere.

## Applying them

Supabase dashboard → Authentication → Emails → Templates, once per project
(dev and prod are separate, with separate template settings):

| File | Template | Suggested subject |
| --- | --- | --- |
| `magic-link.html` | Magic Link | `Your SafeCampus sign-in code` |
| `confirm-signup.html` | Confirm signup | `Confirm your email for SafeCampus` |
| `invite.html` | Invite user | `You've been invited to SafeCampus` |

Paste the file's whole contents into the message body; subjects are set in
the same screen.

**Until `magic-link.html` and `confirm-signup.html` are pasted, the switch is
only half done**: the sign-in page asks for a code while Supabase's default
template still sends a link. The link still works in the meantime — but it
is exactly the scanner-vulnerable thing this replaces.

### Settings that go with it

- **Site URL** (Authentication → URL Configuration): `https://www.safecampus.net`
  for production, `https://dev.safecampus.net` for dev. The logo and the
  dashboard invite's button are built from it.
- **Email OTP expiration** (Authentication → Providers → Email): how long a
  code works. The default is one hour, which is fine for sign-in but short
  for an invitation someone reads the next morning. Invitations recover on
  their own — the sign-in page sends a fresh code — so this is a judgement
  call rather than a requirement.
- **Email OTP length**: the page and the templates say "6-digit". If this is
  changed, change the copy in `src/app/login/page.tsx` and here.

## Deliverability

These were rewritten after Proofpoint classified invitations as junk. What
mattered, in rough order: saying who invited the recipient and what
SafeCampus is rather than "you've been invited, click here"; naming the
sender and the organisation in the footer with guidance for someone who
wasn't expecting it; and a real plain-text alternative carrying the same
content.

Supabase sends these over SMTP, so SendGrid's **account-level click
tracking** rewrites links in them to `*.ct.sendgrid.net` redirects. With
codes instead of sign-in links that no longer endangers the credential, but
it still puts an unfamiliar domain under every link in the message — turn
it off under Settings > Tracking > Click Tracking. The app's own mail
disables it per message.

## Notes

- **`{{ .Data.organization_name }}`** in `invite.html` comes from the `data`
  passed to `generateLink` in `src/lib/inviteEmail.ts`. It is wrapped in
  `{{ if }}` so an invite sent any other way still renders.
- **Old links still work.** `/auth/confirm` verifies the token-hash links
  sent before the switch, so nothing already in someone's inbox breaks.
- Password reset and reauthentication templates are deliberately absent —
  there are no passwords in this app.
