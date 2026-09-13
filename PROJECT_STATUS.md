# Project status

**Current phase:** V2 foundation implemented; external credentials and production acceptance remain

## Complete

- Product decisions and permission model agreed.
- Brand guidelines translated into design tokens and UI direction.
- Fresh Supabase project created in Mumbai.
- New modular Next.js application and initial database migration created.
- Payment finalization, referral ledger, employee dashboard, operations console, offline payouts, and temporary edit grants implemented.
- Supabase migrations `0001` through `0004` and geography seed applied to project `pryknxknjbwypdudtryz`.
- TypeScript, ESLint, tests, production build, and browser verification are tracked below.

## External configuration required

- Add the new Supabase secret key to `.env.local`.
- Add Razorpay test/live keys and configure the webhook endpoint.
- Replace development seed credentials before production.

## Verification

- `npm run typecheck` — passed
- `npm run lint` — passed with zero warnings
- `npm test` — 2/2 passed
- `npm run build` — passed; 18 routes generated
- Home, registration and login pages — visually checked in a browser
- Desktop and 390×844 mobile layouts — visually checked
- Crop tabs, mobile menu and dynamic add-plot controls — interacted with successfully; zero browser errors after CSP correction
- Supabase monetary lifecycle — passed in a rolled-back integration transaction
- `anon` and `authenticated` access to `private.person_identifiers` — verified false

## Known external blockers

- The app needs the new project's server secret in `.env.local`; the management connector does not expose secret keys.
- Razorpay credentials and the production webhook are not configured yet, so real payments are intentionally unavailable.
- A first super-admin mobile/password must be chosen before the controlled bootstrap seed is run.
