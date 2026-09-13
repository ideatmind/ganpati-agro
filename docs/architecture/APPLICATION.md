# Application architecture

Next.js emits inline bootstrap data for hydration, so the response CSP permits inline scripts while limiting external scripts to the Razorpay checkout origin. Moving to per-request CSP nonces is a documented production-hardening option if all affected routes are made dynamic deliberately.

The product is a modular Next.js monolith. App Router files own routing; feature modules own validation and business workflows; server modules own secrets, sessions, Supabase access, and Razorpay integration.

Reads are performed in Server Components. Interactive registration, payment checkout, print, and navigation controls are small Client Components. External callbacks use Route Handlers.
