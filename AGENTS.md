# Repository instructions

This is a Next.js 16 App Router application. Before changing framework code, read the relevant guide under `node_modules/next/dist/docs/` and follow Next.js 16 conventions, including async `params`, `searchParams`, and `cookies()`.

## Product invariants

- The registration fee is snapshotted in paise; its initial value is ₹500 (`50000`).
- A farmer and membership are created only after a captured Razorpay payment is verified.
- Payment finalization is idempotent: browser verification and duplicate/out-of-order webhooks must produce one farmer, membership, receipt, and referral earning.
- A registration has at most one commission recipient. The initial commission is 10% (`1000` basis points), snapshotted at checkout.
- Farmer referral commission takes priority over employee onboarding credit. Employees still retain onboarding-count attribution.
- Employees keep collected cash and personally complete the online payment; there is no later company cash settlement.
- Mobile and Aadhaar fingerprint are unique per person. Aadhaar must never appear in logs, receipts, bulk exports or audit details. Per the owner's updated requirement, super-admins may reveal it on demand through a separately authorized, audited, no-store endpoint; ordinary reads and other roles must never receive it.
- Employees only see farmers they onboarded. Post-payment edits require manager/super-admin status or an unexpired scoped permission grant.
- Referral payouts are recorded after offline disbursement. Referrers can view balances and payouts but cannot request claims in the product.
- Payment and financial history is immutable; use corrective records instead of deletion.

## Architecture

- Keep `src/app` focused on routing and layouts.
- Put business rules in `src/features/*/server` and shared infrastructure in `src/server`.
- Keep privileged secrets and database access in modules importing `server-only`.
- Use Server Components for reads and Client Components only for browser interaction.
- All trust-boundary input must be validated. Derive the acting account from the signed session, never from a client-supplied actor ID.
- Database migrations are ordered files in `supabase/migrations`. Enable RLS on exposed tables, revoke default privileges, index foreign keys, and keep privileged functions callable only by the service role.

## Design invariants

- Treat the original Ganpati Agro site as the composition and interaction reference: centered video hero, glowing logo, transparent-to-solid navigation, illustrated agricultural cards, and bilingual fieldset form.
- Use the supplied brand-kit color tokens and self-hosted Noto Sans Devanagari/Poppins fonts; do not introduce build-time font downloads.
- Preserve keyboard access, visible focus, mobile layouts, reduced-motion behavior, scroll reveals, tab transitions, animated counters, and plot-entry feedback.
- Do not simplify the registration form by removing attributes, bilingual labels, validation hints, consent context, referral input, account password fields, employee cash controls, or payment state feedback.

## Required checks

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. Payment, authorization, or accounting changes require a focused test. Update `PROJECT_STATUS.md` and the relevant decision or business-rule document when behavior changes.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
