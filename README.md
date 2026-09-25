# Shri Ganpati Agro

Farmer registration, ₹500 standard and ₹2,500 Focused Value Chain memberships, verified Razorpay payment, employee-assisted onboarding, referrals, earnings, offline payout records, and role-aware operations for Shri Ganpati Agro Producer Company Ltd.

## Setup

1. Install Node.js 22.18 or newer within the 22.x release line, with npm. `.nvmrc` records the verified development version; CI and hosting also use Node 22.
2. Run `npm ci` to install the exact dependencies in `package-lock.json`.
3. Copy `.env.example` to `.env.local` only if that file does not already exist, then configure Supabase, session, encryption, and Razorpay values. Use `http://localhost:3000` for both `APP_ORIGIN` and `NEXT_PUBLIC_APP_URL` when running locally.
4. For a fresh Supabase project, apply every SQL file in `supabase/migrations` in numeric order, followed by `supabase/seeds/geography.sql`. Use `supabase/seeds/development.sql` only in a test environment. For an existing database, reconcile its migration history before applying changes.
5. Run `npm run dev` and open `http://localhost:3000`.

On Windows, reopen the terminal after installing Node so it receives the updated PATH. If PowerShell blocks `npm.ps1`, use `npm.cmd` and `npx.cmd` instead.

## Checks and optional tools

Run `npm run lint`, `npx next typegen`, `npm run typecheck`, `npm test`, and `npm run build`. Route type generation is needed before typechecking a fresh checkout. `npm audit` checks the installed dependency tree against the registry's reported advisories.

- Browser regression scripts and the PDF leaflet utility use the development dependency `playwright`. Install their browser with `npx playwright install chromium`. The browser regression scripts require an isolated local app and the fixtures described in [the role UI verification report](docs/ROLE_UI_REMEDIATION_20260916.md).
- Database, concurrency, and HTTP regression suites require PostgreSQL 16, its `psql` client, and an isolated migrated loopback database. Set `TEST_DATABASE_URL` and, if `psql` is not on PATH, `PSQL_PATH`. Follow [the production runbook](docs/PRODUCTION_RUNBOOK.md#reproduce-the-checks); these tools are not needed to build the app or connect it to a configured hosted Supabase project.
- The optional village import utility requires Python and `openpyxl`. The optional leaflet generators require separate dependencies and a content review before distribution; see [the tooling notes](tools/README.md). These are separate from the web application's npm dependencies.

Supabase and Razorpay calls use native server-side `fetch`; their JavaScript SDK packages are not required by this application. Fonts are installed locally through `@fontsource`.

Start with [PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) and [ROADMAP.md](plans/ROADMAP.md).
