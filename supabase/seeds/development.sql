-- TEST ENVIRONMENT ONLY. Change these credentials immediately.
with a as (
  insert into public.accounts(mobile,password_hash,display_name,status)
  values('9999999999',crypt('ChangeMe123!',gen_salt('bf',12)),'Super Admin','active')
  on conflict(mobile) do update set display_name=excluded.display_name returning id
)
insert into public.account_roles(account_id,role) select id,'super_admin' from a on conflict do nothing;

insert into public.referrer_profiles(account_id,referral_code)
select id,'GASUPER1' from public.accounts where mobile='9999999999' on conflict(account_id) do nothing;
