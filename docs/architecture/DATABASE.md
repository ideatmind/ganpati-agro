# Database architecture

The `public` tables use deny-all RLS for browser roles. The application reaches a narrow set of `security definer` RPC functions with a server-only Supabase secret. The `private` schema containing protected Aadhaar material has no `USAGE` or table privileges for `anon` or `authenticated`; this is verified after migration.

The database separates identities, registration snapshots, active farmers, gateway records, referral accounting, permissions, and audit history. Check constraints and unique indexes enforce money, identity, and idempotency invariants. Foreign keys are indexed for dashboard and retention operations.

All exposed tables have RLS enabled with no public policies. The Next.js server uses the Supabase secret key. Privileged RPCs are executable only by `service_role` and derive business outcomes inside short transactions.
