-- New checkouts use the owner-approved INR 1 live trial fee.
-- Previous fee versions and registration snapshots are immutable history.
insert into public.fee_versions(amount_paise,effective_from) values (100,clock_timestamp());
