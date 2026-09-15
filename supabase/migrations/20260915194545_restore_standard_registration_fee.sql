-- Owner-requested standard fee for new registrations: INR 500.
-- Preserve existing checkout quotes, payments, receipts and referral snapshots.
insert into public.fee_versions(amount_paise,effective_from)
values (50000,clock_timestamp());
