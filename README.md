# Shri Ganpati Agro

Farmer registration, ₹500 Razorpay payment, employee-assisted onboarding, referrals, earnings, offline payout records, and role-aware operations for Shri Ganpati Agro Producer Company Ltd.

## Setup

1. Copy `.env.example` to `.env.local` and configure Supabase, session, encryption, and Razorpay values.
2. Apply every SQL file in `supabase/migrations` in numeric order to a fresh Supabase project.
3. Apply `supabase/seeds/geography.sql`, and use `supabase/seeds/development.sql` only in a test environment.
4. Run `npm install` and `npm run dev`.

Start with [PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) and [ROADMAP.md](plans/ROADMAP.md).
