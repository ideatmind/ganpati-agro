-- Synthetic fixtures, for an isolated loopback database only. Not a payment acceptance test.
\set ON_ERROR_STOP on
begin;
insert into public.accounts(id,mobile,password_hash,display_name,status)
values ('10000000-0000-4000-8000-000000000001','6999999999',extensions.crypt('isolated performance password',extensions.gen_salt('bf',12)),'Performance admin','active') on conflict do nothing;
insert into public.account_roles values ('10000000-0000-4000-8000-000000000001','super_admin',now()) on conflict do nothing;
create temp table fixture as select n,md5('perf-account-'||n)::uuid a,md5('perf-person-'||n)::uuid p,md5('perf-registration-'||n)::uuid g,md5('perf-referrer-'||n)::uuid rp,md5('perf-farmer-'||n)::uuid f from generate_series(1,:volume) n;
insert into public.accounts(id,mobile,password_hash,display_name,status)
select a,'60'||lpad(n::text,8,'0'),'not-a-login-hash','Synthetic farmer '||lpad(n::text,6,'0'),'active' from fixture on conflict do nothing;
insert into public.persons(id,account_id,name,mobile,date_of_birth,village,taluka,district,income_source,cluster_type)
select p,a,'Synthetic farmer '||lpad(n::text,6,'0'),'60'||lpad(n::text,8,'0'),'1990-01-01','Synthetic village','dharashiv','dharashiv','agriculture','pulses' from fixture on conflict do nothing;
insert into public.referrer_profiles(id,account_id,referral_code) select rp,a,'PERF'||lpad(n::text,8,'0') from fixture on conflict do nothing;
insert into public.registrations(id,reference,person_id,fee_version_id,fee_amount_paise,commission_rate_id,commission_basis_points,status,channel,payment_mode,consent_given,referrer_profile_id,completed_at,created_at)
select g,'PERF-'||lpad(n::text,8,'0'),p,(select id from public.fee_versions limit 1),50000,(select id from public.commission_rate_versions limit 1),1000,'completed','public','farmer_online',true,rp,now(),now()-n*interval '1 second' from fixture on conflict do nothing;
insert into public.farmers(id,person_id,registration_id) select f,p,g from fixture on conflict do nothing;
insert into public.referral_earnings(registration_id,referrer_profile_id,fee_amount_paise,basis_points,amount_paise) select g,rp,50000,1000,5000 from fixture on conflict do nothing;
commit;
analyze;
