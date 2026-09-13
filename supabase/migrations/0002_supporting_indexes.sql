begin;

create index cash_collections_corrected_by_idx on public.cash_collections(corrected_by) where corrected_by is not null;
create index commission_rates_created_by_idx on public.commission_rate_versions(created_by) where created_by is not null;
create index fee_versions_created_by_idx on public.fee_versions(created_by) where created_by is not null;
create index referral_payouts_recorded_by_idx on public.referral_payouts(recorded_by);
create index registrations_fee_version_idx on public.registrations(fee_version_id);
create index registrations_commission_rate_idx on public.registrations(commission_rate_id);
create index permission_grants_farmer_idx on public.temporary_permission_grants(farmer_id);
create index permission_grants_granted_by_idx on public.temporary_permission_grants(granted_by);
create index permission_grants_revoked_by_idx on public.temporary_permission_grants(revoked_by) where revoked_by is not null;

commit;
