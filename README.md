# SafeCampus

Team management, scheduling, and notifications for safety teams and organizations of every kind — rosters, location-scoped roles, certification and training tracking, secure document and watchlist storage, Planning Center import, and automated reminders by email (SendGrid) and SMS (SignalWire).

The full architecture and data model are documented in the project's architecture brief (Supabase/Postgres, Next.js, RLS design, platform admin support access, dev/prod environments).

## Stack

- **Frontend**: Next.js (App Router, TypeScript)
- **Backend**: Supabase (Postgres, Auth, Storage, Edge Functions)
- **Notifications**: SendGrid (email), SignalWire (SMS)
- **AI**: Anthropic Claude, for the Threat Intelligence add-on
- **Calendar source**: Planning Center API

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project's URL and publishable key
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database

Schema and Row Level Security policies live in `supabase/migrations/` as versioned SQL, applied with the [Supabase CLI](https://supabase.com/docs/guides/cli).

In normal use you don't run these by hand — pushing to `dev` or `main` applies them (see below). When you do need to, pass the project explicitly rather than using `supabase link`, so the target is visible in the command instead of in link state left on disk by an earlier one:

```bash
npx supabase db push --project-ref <project-ref>
npx supabase migration list --project-ref <project-ref>   # what's applied where
```

`--dry-run` prints what would be applied without applying it; worth the habit against prod.

Apply migrations to the dev project first, verify, then promote the same files to prod.

### Automated migrations (GitHub Actions)

`.github/workflows/supabase-migrate.yml` runs `supabase db push` on every push to `dev` or `main`, targeting a different Supabase project per branch via GitHub Environments. `dev` applies immediately; `main` waits for approval if the environment has a reviewer rule. To activate it:

1. In the repo's Settings → Environments, create two environments: `dev` and `production`.
2. In each, add secrets `SUPABASE_PROJECT_ID` (Settings → General → Reference ID in that Supabase project) and `SUPABASE_DB_PASSWORD` (the database password set when the project was created).
3. Add a repository-level secret `SUPABASE_ACCESS_TOKEN` (Supabase account → Access Tokens) — this one's account-scoped, not project-scoped, so it's shared across both environments.
4. Optional but recommended before this touches real data: add a required-reviewer protection rule to the `production` environment, so a push to `main` pauses for approval before the migration actually runs.

Until these secrets exist, the workflow will run and fail harmlessly on push — it doesn't block anything else in CI.

The workflow pins an exact CLI version rather than `latest`, and passes `--project-ref` instead of running `supabase link`. Both are deliberate: a CLI release once changed what `link` required and broke every run overnight with unchanged secrets.

If migrations were ever applied by hand through the Supabase SQL editor, the CLI won't know about them and `db push` will try to re-run everything. Tell it the truth once per project:

```bash
npx supabase migration repair --status applied <version> [<version> ...]
```

## Branches

- `main` — tracks the production Supabase project and Vercel production deploy.
- `dev` — tracks the development Supabase project and Vercel preview deploys.

Nothing reaches `main` without going through `dev` first.

## Environment variables

`.env.example` is the reference — copy it to `.env.local` and fill in what you need. Notes on the ones that aren't self-evident:

- `SENDGRID_FROM_EMAIL` must be a verified sender on the SendGrid account. Without it, reminder emails fail and land in `notifications` with `status: 'failed'`.
- `EMAIL_UNSUBSCRIBE_SECRET` signs the one-click unsubscribe links. Rotating it invalidates every link already sent.
- `CRON_SECRET` authenticates Vercel Cron's calls to `/api/cron/*`. Those routes use the service-role client, so a missing or wrong value is refused outright — an unset secret does not mean an open endpoint.
- `X_BEARER_TOKEN` is optional. Left unset, Threat Intelligence skips X search and still generates.

## Scheduled jobs

`vercel.json` registers three crons, all authenticated with `CRON_SECRET`:

| Path | Cadence | What it does |
| --- | --- | --- |
| `/api/cron/generate-events` | daily 06:00 UTC | Extends every active series to a year ahead |
| `/api/cron/send-shift-reminders` | daily 13:00 UTC | Email and SMS reminders, 3 days and 24 hours out |
| `/api/cron/generate-threat-reports` | Mondays 12:00 UTC | Threat Intelligence briefs for orgs with the add-on |

Vercel Cron only fires against the production deployment. To exercise one elsewhere, call it directly with the same bearer token.
