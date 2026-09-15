begin;
-- Financial records are changed only through owner-executed, service-only RPCs.
revoke insert,update,delete,truncate on public.cash_collections,public.payment_orders,public.payment_events,public.payout_allocations from service_role;
create trigger immutable_cash before update or delete on public.cash_collections for each row execute function private.prevent_history_change();
create trigger immutable_allocations before update or delete on public.payout_allocations for each row execute function private.prevent_history_change();

create function private.protect_payment_evidence() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Financial and audit history is immutable; use corrective records'; end if;
 if tg_table_name='payment_orders' then
  if (to_jsonb(new)-array['status','paid_at']) is distinct from (to_jsonb(old)-array['status','paid_at'])
   or (old.status='paid' and new.status<>'paid') or (old.paid_at is not null and new.paid_at is distinct from old.paid_at) then
   raise exception 'Financial and audit history is immutable; use corrective records';
  end if;
 elsif (to_jsonb(new)-array['status','processed_at','error_message','payment_order_id']) is distinct from (to_jsonb(old)-array['status','processed_at','error_message','payment_order_id'])
  or (old.payment_order_id is not null and new.payment_order_id is distinct from old.payment_order_id) then
  raise exception 'Financial and audit history is immutable; use corrective records';
 end if;
 return new;
end; $$;
create trigger immutable_order_evidence before update or delete on public.payment_orders for each row execute function private.protect_payment_evidence();
create trigger immutable_event_evidence before update or delete on public.payment_events for each row execute function private.protect_payment_evidence();
revoke all on function private.protect_payment_evidence() from public,anon,authenticated,service_role;

create function public.get_registration_fee() returns integer language sql stable security definer set search_path='' as $$
 select amount_paise from public.fee_versions where effective_from<=now() and (effective_to is null or effective_to>now()) order by effective_from desc limit 1;
$$;
revoke all on function public.get_registration_fee() from public,anon,authenticated;
grant execute on function public.get_registration_fee() to service_role;

CREATE OR REPLACE FUNCTION public.create_registration(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_account_id uuid; v_person_id uuid; v_registration_id uuid; v_referrer_id uuid;
  v_fee public.fee_versions; v_rate public.commission_rate_versions; v_plot jsonb;
  v_employee_id uuid; v_reference text; v_ref_code text;
begin
  perform pg_advisory_xact_lock(hashtextextended('registration:'||(p_payload->>'mobile'),0));
  if octet_length(p_payload->>'password')>72 then raise exception 'Password exceeds bcrypt byte limit'; end if;
  -- A lost response can be retried only by the same submitter with matching credentials/identity.
  select a.id into v_account_id from public.accounts a where a.mobile=p_payload->>'mobile';
  if v_account_id is not null and exists(
    select 1 from public.accounts a join public.persons p on p.account_id=a.id
    join private.person_identifiers i on i.person_id=p.id join public.registrations g on g.person_id=p.id
    where a.id=v_account_id and a.password_hash=extensions.crypt(p_payload->>'password',a.password_hash)
      and i.aadhar_fingerprint=p_payload->>'aadhar_fingerprint'
      and g.onboarding_employee_id is not distinct from nullif(p_payload->>'onboarding_employee_id','')::uuid
  ) then
    return (select jsonb_build_object('id',g.id,'reference',g.reference,'amountPaise',g.fee_amount_paise,'status',g.status)
      from public.registrations g join public.persons p on p.id=g.person_id where p.account_id=v_account_id);
  end if;
  if (p_payload->>'mobile') !~ '^[0-9]{10}$' or char_length(p_payload->>'password') < 8 then
    raise exception 'A valid mobile number and password of at least 8 characters are required';
  end if;
  if (p_payload->>'aadhar_fingerprint') !~ '^[0-9a-f]{64}$' then raise exception 'Invalid identity data'; end if;
  if coalesce((p_payload->>'consent')::boolean,false) is not true then raise exception 'Consent is required'; end if;
  if jsonb_array_length(p_payload->'plots') not between 1 and 10 then raise exception 'One to ten plots are required'; end if;
  if exists(select 1 from public.accounts where mobile=p_payload->>'mobile') then raise exception 'An account already exists for this mobile number'; end if;
  if exists(select 1 from private.person_identifiers where aadhar_fingerprint=p_payload->>'aadhar_fingerprint') then raise exception 'An account already exists for this Aadhaar number'; end if;

  v_employee_id := nullif(p_payload->>'onboarding_employee_id','')::uuid;
  if v_employee_id is not null and not private.has_role(v_employee_id,array['employee','manager','super_admin']) then
    raise exception 'Invalid onboarding employee';
  end if;
  v_ref_code := upper(nullif(trim(p_payload->>'referral_code'),''));
  if v_ref_code is not null then
    select id into v_referrer_id from public.referrer_profiles where referral_code=v_ref_code and active;
    if v_referrer_id is null then raise exception 'Invalid referral code'; end if;
  elsif v_employee_id is not null then
    select id into v_referrer_id from public.referrer_profiles where account_id=v_employee_id and active;
  end if;

  select * into v_fee from public.fee_versions where effective_from<=now() and (effective_to is null or effective_to>now()) order by effective_from desc limit 1;
  select * into v_rate from public.commission_rate_versions where effective_from<=now() and (effective_to is null or effective_to>now()) order by effective_from desc limit 1;
  if v_fee.id is null or v_rate.id is null then raise exception 'Registration pricing is not configured'; end if;
  if p_payload?'expected_fee_paise' and (p_payload->>'expected_fee_paise')::integer is distinct from v_fee.amount_paise then raise exception 'Registration fee changed'; end if;

  insert into public.accounts(mobile,password_hash,display_name)
  values(p_payload->>'mobile',extensions.crypt(p_payload->>'password',extensions.gen_salt('bf',12)),trim(p_payload->>'name')) returning id into v_account_id;
  insert into public.account_roles(account_id,role) values(v_account_id,'farmer_referrer');
  insert into public.referrer_profiles(account_id,referral_code)
  values(v_account_id,'GA'||upper(substr(replace(v_account_id::text,'-',''),1,8)));

  if exists(select 1 from public.referrer_profiles where id=v_referrer_id and account_id=v_account_id) then raise exception 'Self-referral is not allowed'; end if;
  insert into public.persons(account_id,name,mobile,date_of_birth,village,taluka,district,income_source,cluster_type)
  values(v_account_id,trim(p_payload->>'name'),p_payload->>'mobile',(p_payload->>'date_of_birth')::date,trim(p_payload->>'village'),p_payload->>'taluka',p_payload->>'district',p_payload->>'income_source',p_payload->>'cluster_type')
  returning id into v_person_id;
  insert into private.person_identifiers(person_id,aadhar_fingerprint,aadhar_ciphertext,aadhar_last_four)
  values(v_person_id,p_payload->>'aadhar_fingerprint',p_payload->>'aadhar_ciphertext',right(p_payload->>'aadhar_last_four',4));

  v_reference := 'REG-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.registration_reference_seq')::text,6,'0');
  insert into public.registrations(reference,person_id,fee_version_id,fee_amount_paise,commission_rate_id,commission_basis_points,channel,payment_mode,onboarding_employee_id,referrer_profile_id,consent_given)
  values(v_reference,v_person_id,v_fee.id,v_fee.amount_paise,v_rate.id,v_rate.basis_points,
    case when v_employee_id is null then 'public' else 'employee_assisted' end,
    case when v_employee_id is not null and coalesce((p_payload->>'cash_received')::boolean,false) then 'employee_cash_assisted' else 'farmer_online' end,
    v_employee_id,v_referrer_id,true) returning id into v_registration_id;

  for v_plot in select * from jsonb_array_elements(p_payload->'plots') loop
    insert into public.registration_plots(registration_id,plot_no,area_acres,crop_name,irrigation_source)
    values(v_registration_id,trim(v_plot->>'plot_no'),(v_plot->>'area_acres')::numeric,trim(v_plot->>'crop_name'),v_plot->>'irrigation_source');
  end loop;
  if v_employee_id is not null and coalesce((p_payload->>'cash_received')::boolean,false) then
    insert into public.cash_collections(registration_id,employee_id,amount_paise,note)
    values(v_registration_id,v_employee_id,v_fee.amount_paise,nullif(trim(p_payload->>'cash_note'),''));
  end if;
  insert into public.audit_events(actor_account_id,action,target_type,target_id,details)
  values(v_employee_id,'registration_created','registration',v_registration_id::text,jsonb_build_object('channel',case when v_employee_id is null then 'public' else 'employee_assisted' end));
  return jsonb_build_object('id',v_registration_id,'reference',v_reference,'amountPaise',v_fee.amount_paise,'status','payment_pending');
end;
$function$

;

create or replace function public.get_admin_registration(p_actor_id uuid,p_registration_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.has_role(p_actor_id,array['manager','super_admin']) then raise exception 'Not authorized'; end if;
 select jsonb_build_object('id',g.id,'reference',g.reference,'name',coalesce(p.name,'Deleted farmer'),'mobileMasked','******'||right(p.mobile,4),'status',g.status,'amountPaise',g.fee_amount_paise,'createdAt',g.created_at,'completedAt',g.completed_at,'employee',a.display_name,'referralCode',rp.referral_code,'paymentMode',g.payment_mode,'farmerId',f.id,'membership',m.membership_number,'receiptNumber',r.receipt_number,'receiptToken',r.public_token,
  'orders',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'providerOrderId',o.provider_order_id,'amountPaise',o.amount_paise,'status',o.status,'createdAt',o.created_at,'paidAt',o.paid_at,'payments',coalesce((select jsonb_agg(jsonb_build_object('paymentId',pa.provider_payment_id,'amountPaise',pa.amount_paise,'status',pa.status,'capturedAt',pa.captured_at)) from public.payment_attempts pa where pa.payment_order_id=o.id),'[]'::jsonb))) from public.payment_orders o where o.registration_id=g.id),'[]'::jsonb)) into result
 from public.registrations g left join public.persons p on p.id=g.person_id left join public.accounts a on a.id=g.onboarding_employee_id left join public.referrer_profiles rp on rp.id=g.referrer_profile_id left join public.farmers f on f.registration_id=g.id left join public.memberships m on m.registration_id=g.id left join public.receipts r on r.registration_id=g.id where g.id=p_registration_id;
 return result;
end; $$;


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
    'pendingOnboardings',coalesce((select jsonb_agg(x) from (select g.reference,p.name as "farmerName",g.fee_amount_paise as "amountPaise",g.payment_mode as "paymentMode",g.status from public.registrations g join public.persons p on p.id=g.person_id where g.onboarding_employee_id=p_account_id and g.status<>'completed' order by g.created_at desc limit 20) x),'[]'::jsonb),
    'recentEarnings',coalesce((select jsonb_agg(x) from (select re.amount_paise as "amountPaise",re.credited_at as "creditedAt",coalesce(p.name,'Deleted farmer') as "farmerName",g.reference
      from public.referral_earnings re join public.registrations g on g.id=re.registration_id left join public.persons p on p.id=g.person_id
      where re.referrer_profile_id=v_profile order by re.credited_at desc limit 10) x),'[]'::jsonb),
    'recentPayouts',coalesce((select jsonb_agg(x) from (select amount_paise as "amountPaise",method,payment_reference as "reference",paid_at as "paidAt"
      from public.referral_payouts where referrer_profile_id=v_profile order by paid_at desc limit 10) x),'[]'::jsonb)
  );
end;
$$;


create or replace function public.update_farmer_profile(p_actor_id uuid,p_farmer_id uuid,p_changes jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_person_id uuid; v_allowed text[]; v_keys text[];
begin
  perform 1 from public.registrations where id=(select registration_id from public.farmers where id=p_farmer_id) for update;
  select person_id into v_person_id from public.farmers where id=p_farmer_id for update;
  if v_person_id is null then raise exception 'Farmer not found'; end if;
  if private.has_role(p_actor_id,array['manager','super_admin']) then
    v_allowed := array['name','date_of_birth','village','district','taluka','income_source','cluster_type'];
  else
    if not private.has_role(p_actor_id,array['employee']) or not exists(select 1 from public.farmers where id=p_farmer_id and onboarding_employee_id=p_actor_id) then raise exception 'Not authorized'; end if;
    select coalesce(array_agg(distinct field),array[]::text[]) into v_allowed from public.temporary_permission_grants g cross join unnest(g.allowed_fields) field
    where g.employee_id=p_actor_id and g.farmer_id=p_farmer_id and g.revoked_at is null and g.expires_at>now();
  end if;
  select coalesce(array_agg(key),array[]::text[]) into v_keys from jsonb_object_keys(p_changes) key;
  if cardinality(v_keys)=0 or not v_keys<@v_allowed then raise exception 'One or more fields are not authorized'; end if;
  update public.persons set
    name=case when p_changes?'name' then trim(p_changes->>'name') else name end,
    date_of_birth=case when p_changes?'date_of_birth' then (p_changes->>'date_of_birth')::date else date_of_birth end,
    village=case when p_changes?'village' then trim(p_changes->>'village') else village end,
    district=case when p_changes?'district' then p_changes->>'district' else district end,
    taluka=case when p_changes?'taluka' then p_changes->>'taluka' else taluka end,
    income_source=case when p_changes?'income_source' then p_changes->>'income_source' else income_source end,
    cluster_type=case when p_changes?'cluster_type' then p_changes->>'cluster_type' else cluster_type end,
    updated_at=now() where id=v_person_id;
  insert into public.audit_events(actor_account_id,action,target_type,target_id,details)
  values(p_actor_id,'farmer_profile_updated','farmer',p_farmer_id::text,jsonb_build_object('fields',v_keys));
  return public.get_farmer_detail(p_actor_id,p_farmer_id);
end;
$$;


commit;
