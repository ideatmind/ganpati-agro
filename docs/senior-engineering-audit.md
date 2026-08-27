# Senior Engineering Audit

## Scope

Read-only review of the current static website, browser-side registration flow, and the supplied Supabase schema. No production database requests or source changes were made as part of this audit.

## Executive summary

The marketing site is lightweight and appropriate for a no-framework implementation. The registration architecture, however, is not safe for production: the browser writes personal data directly to Supabase, and the supplied Row Level Security policies grant unrestricted anonymous access to both data tables.

The core design decision should be: **a static website with a small protected registration API**, not a browser application with direct access to farmer data.

## P0 — resolve before accepting registrations

### 1. Anonymous users have unrestricted database access

**Evidence**

- `script.js` sends registrations directly to the Supabase REST API.
- `docs/supabase-schema.sql` enables RLS but then creates `FOR ALL USING (true) WITH CHECK (true)` policies and grants `ALL` to `anon`.

**Impact**

Anyone with the public website can attempt to read, create, update, or delete farmer and farm-plot data. The issue is not that the Supabase publishable key is visible in client code; it is expected to be visible. The issue is the policy that allows that key unrestricted table access.

**Required design**

```text
Browser -> POST /api/registration -> validate + rate limit + CAPTCHA -> database transaction/RPC
```

- Disable direct anonymous access to personal-data tables.
- Keep any Supabase service credential only in server-side environment variables.
- Use a serverless function (for example, a Vercel function if Vercel is the deployment host).
- Validate and normalize every field on the server, impose payload/plot limits, rate-limit requests, and add bot protection.
- Return generic user-facing errors only; record technical details in server logs.

### 2. Aadhaar and DOB must not be collected in the public web form

**Evidence**

- The public form includes Aadhaar and DOB fields.
- The schema stores Aadhaar in plaintext and makes it unique.
- `docs/design_plan.md` explicitly states that Aadhaar/PAN should not be collected on the website.

**Impact**

This creates unnecessary privacy and security exposure, especially when combined with public data access. A public registration form should collect only the data needed to contact a prospective applicant.

**Required design**

- Remove Aadhaar and DOB from the website form.
- Add a visible privacy notice, explicit consent, the purpose of collection, retention period, and a withdrawal/contact method.
- If identity documentation is ever genuinely required, collect it through a controlled internal process with restricted access, audit trails, encryption/key management, and documented retention rules.

### 3. Registration is not atomic

**Evidence**

The client inserts a farmer first and then inserts farm plots in a separate request.

**Impact**

If plot insertion fails, an orphan farmer record remains. Retrying may create duplicate registrations.

**Required design**

- Submit the complete payload to one server endpoint.
- Use one database transaction or an RPC/stored procedure to insert the request and its plots.
- Add idempotency based on a normalized contact value plus a client-generated request ID.
- Do not return inserted personal records to the browser merely to obtain an ID.

## Database design

### Separate intake from verified membership

The public website should not create a fully verified `farmers` record. Model the lifecycle explicitly:

- `registration_requests`: minimal public submission, consent timestamp, request status, source, and idempotency data.
- `farmers`: a verified/approved farmer record created by authorized staff.
- `farm_plots`: verified holdings linked to `farmers`.
- Optional lookup tables for staff-managed `talukas`, cluster types, and irrigation sources.

This supports review and approval instead of treating a website form as official enrollment.

### Improve data integrity

- Enforce mobile-number format in the database, not only in browser HTML.
- Remove the redundant explicit Aadhaar index: a `UNIQUE` constraint already creates an index. Prefer removing the field entirely from public intake.
- Avoid free-text district/taluka fields where reporting requires consistent values. The existing `other` taluka value has no companion field to capture the real value.
- Use normalized values for reporting fields and add indexes only for measured admin queries. Likely early candidates are request `status, created_at`, `taluka`, and `farm_plots.farmer_id`.
- Do not add indexes preemptively for low-cardinality fields such as cluster type until real query plans demonstrate a benefit.

## Code structure and quality

`script.js` passes `node --check`, but it combines DOM behavior, rendering, validation, API access, and registration mapping in one IIFE.

Keep the no-framework approach, but split responsibilities into small ES modules:

```text
main.js
ui/navigation.js
ui/tabs.js
ui/farm-plots.js
registration/validation.js
registration/api.js
config/constants.js
```

Additional improvements:

- Replace the long dynamic `innerHTML` farm-plot template with a `<template>` element or DOM builder. It is not currently user-controlled XSS, but it is brittle and hard to test.
- Keep crop/taluka/category definitions in a single configuration source instead of repeating values across markup and scripts.
- Add a maximum number of plots on both client and server.
- Add request timeouts/cancellation and accessible inline form errors; do not expose backend error text through `alert()`.
- Add unit tests for validation and payload creation, integration tests for registration success/failure/duplicates, linting/formatting, and CI.

## Performance and delivery

The main delivery concern is media size, particularly for mobile users:

- `assets/hero-bg.mp4`: approximately 3.89 MB.
- `assets/logo-icon.png`: approximately 1.22 MB at 1350 x 1165 pixels.

Recommended changes:

- Create responsive compressed WebP/AVIF logo variants and a separate tiny favicon.
- Use a static hero image by default; only load autoplay video when suitable for the connection/device.
- Self-host optimized editorial images rather than relying on Unsplash at runtime. The current image failure handler hides the image instead of offering a meaningful fallback.
- Serve versioned static assets with immutable cache headers.
- Configure Content-Security-Policy, HSTS, Referrer-Policy, Permissions-Policy, and frame protection at deployment.

The existing passive scroll listeners are low priority at this scale; data security and media payloads are materially more important.

## Accessibility and user experience

- Add a `<main>` landmark and a skip-to-content link.
- Complete tab semantics with `aria-controls`, `aria-labelledby`, focus management, and hidden inactive panels.
- When the mobile menu is closed, remove it from keyboard focus with `inert` or an appropriate visibility state, not only an off-screen transform.
- Replace browser alerts with inline, localized errors associated with the relevant fields and a form-level live region.
- Treat the submitted data as an application/request until reviewed by staff; the wording and confirmation message should reflect that workflow.

## Product and design principles

- Use a different layout primitive per major section rather than repeating generic card grids.
- Preserve Marathi as the primary language; keep English only where it materially supports the intended audience.
- Keep marketing content separate from application logic and use one source of truth for structured lists.
- Apply data minimization: ask only for information necessary for the action the user is taking.

The existing `docs/design_audit.md` contains detailed visual recommendations. This document focuses on system design, reliability, security, and maintainability.

## Implementation order

1. Disable anonymous personal-data table access; remove Aadhaar and DOB from the public form; assess any previously collected data.
2. Add a protected server-side registration endpoint with validation, anti-abuse controls, and a single transactional database operation.
3. Introduce a distinct `registration_requests` intake model and staff approval workflow.
4. Add consent/privacy content, tests, linting, and CI.
5. Optimize hero/logo media and configure caching and security headers.
6. Modularize JavaScript and centralize structured content/configuration.
