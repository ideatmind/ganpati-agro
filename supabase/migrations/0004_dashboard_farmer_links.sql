begin;

create or replace function public.get_dashboard(p_account_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_profile uuid; v_roles text[]; v_is_ops boolean; v_earned bigint; v_paid bigint;
begin
  if not exists(select 1 from public.accounts where id=p_account_id and status='active') then return null; end if;
  select array_agg(role), bool_or(role in ('manager','super_admin')) into v_roles,v_is_ops from public.account_roles where account_id=p_account_id;
  select id into v_profile from public.referrer_profiles where account_id=p_account_id;
  select coalesce(sum(amount_paise),0) into v_earned from public.referral_earnings where referrer_profile_id=v_profile;
  select coalesce(sum(amount_paise),0) into v_paid from public.referral_payouts where referrer_profile_id=v_profile;
  return jsonb_build_object(
    'roles',to_jsonb(v_roles),'earnedPaise',v_earned,'paidPaise',v_paid,'availablePaise',v_earned-v_paid,
    'referralCode',(select referral_code from public.referrer_profiles where id=v_profile),
    'successfulReferrals',(select count(*) from public.referral_earnings where referrer_profile_id=v_profile),
    'onboardedFarmers',(select count(*) from public.farmers where onboarding_employee_id=p_account_id),
    'cashPending',(select count(*) from public.cash_collections c join public.registrations g on g.id=c.registration_id where c.employee_id=p_account_id and g.status<>'completed'),
    'totalFarmers',case when v_is_ops then (select count(*) from public.farmers) else null end,
    'recentOnboardings',coalesce((select jsonb_agg(x) from (select f.id as "farmerId",g.reference,p.name as "farmerName",'******'||right(p.mobile,4) as "mobileMasked",
      g.payment_mode as "paymentMode",g.completed_at as "completedAt"
      from public.farmers f join public.registrations g on g.id=f.registration_id join public.persons p on p.id=f.person_id
      where f.onboarding_employee_id=p_account_id order by f.created_at desc limit 20) x),'[]'::jsonb),
    'recentEarnings',coalesce((select jsonb_agg(x) from (select re.amount_paise as "amountPaise",re.credited_at as "creditedAt",p.name as "farmerName",g.reference
      from public.referral_earnings re join public.registrations g on g.id=re.registration_id join public.persons p on p.id=g.person_id
      where re.referrer_profile_id=v_profile order by re.credited_at desc limit 10) x),'[]'::jsonb),
    'recentPayouts',coalesce((select jsonb_agg(x) from (select amount_paise as "amountPaise",method,payment_reference as "reference",paid_at as "paidAt"
      from public.referral_payouts where referrer_profile_id=v_profile order by paid_at desc limit 10) x),'[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_dashboard(uuid) to service_role;
commit;
