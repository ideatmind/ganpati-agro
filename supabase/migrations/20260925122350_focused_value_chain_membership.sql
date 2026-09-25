begin;
-- Existing rows keep their original prices, identity and financial references.
alter table public.fee_versions add column membership_type text not null default 'standard'
 check(membership_type in ('standard','focused_value_chain'));
create index fee_versions_membership_effective_idx on public.fee_versions(membership_type,effective_from desc);
insert into public.fee_versions(amount_paise,currency,effective_from,membership_type)
values(250000,'INR',now(),'focused_value_chain');
alter table public.registrations
 add column membership_type text not null default 'standard' check(membership_type in ('standard','focused_value_chain')),
 add column cluster_type text;
update public.registrations g set cluster_type=p.cluster_type from public.persons p where p.id=g.person_id;
alter table public.registrations drop constraint registrations_person_id_key,
 add constraint registrations_person_membership_key unique(person_id,membership_type),
 add constraint registrations_focused_cluster_check check(membership_type<>'focused_value_chain' or cluster_type in ('fruits','allied'));
create index registrations_membership_created_idx on public.registrations(membership_type,created_at desc,id);
alter table public.memberships
 add column membership_type text not null default 'standard' check(membership_type in ('standard','focused_value_chain')),
 drop constraint memberships_farmer_id_key,
 add constraint memberships_farmer_type_key unique(farmer_id,membership_type);

create function private.protect_membership_type() returns trigger language plpgsql set search_path='' as $$
begin
 if new.membership_type is distinct from old.membership_type then raise exception 'Membership type is immutable'; end if;
 return new;
end; $$;
revoke all on function private.protect_membership_type() from public,anon,authenticated,service_role;
create trigger immutable_registration_membership before update on public.registrations for each row execute function private.protect_membership_type();
create trigger immutable_membership_type before update on public.memberships for each row execute function private.protect_membership_type();

create function public.get_membership_fee(p_membership_type text) returns integer
language plpgsql stable security definer set search_path='' as $$
begin
 if p_membership_type is null or p_membership_type not in ('standard','focused_value_chain') then raise exception 'Invalid data' using errcode='23514'; end if;
 return (select amount_paise from public.fee_versions where membership_type=p_membership_type and effective_from<=now()
  and (effective_to is null or effective_to>now()) order by effective_from desc limit 1);
end; $$;
create or replace function public.get_registration_fee() returns integer language sql stable security definer set search_path='' as $$
 select public.get_membership_fee('standard');
$$;

create function public.get_membership_form_profile(p_actor_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('name',p.name,'mobile',p.mobile,'dateOfBirth',p.date_of_birth,
  'village',p.village,'district',p.district,'taluka',p.taluka,'incomeSource',p.income_source)
 from public.persons p join public.accounts a on a.id=p.account_id where a.id=p_actor_id and a.status='active';
$$;


CREATE OR REPLACE FUNCTION public.create_membership_registration(p_payload jsonb,p_actor_id uuid default null)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_account_id uuid; v_person_id uuid; v_registration_id uuid; v_referrer_id uuid;
  v_fee public.fee_versions; v_rate public.commission_rate_versions; v_plot jsonb;
  v_employee_id uuid; v_reference text; v_ref_code text;
  v_crops text[]; v_irrigation text[];
  v_kind text:=coalesce(p_payload->>'membership_type','standard'); v_existing public.registrations; v_person public.persons;
begin
  perform pg_advisory_xact_lock(hashtextextended('registration:'||(p_payload->>'mobile'),0));
  if octet_length(p_payload->>'password')>72 then raise exception 'Password exceeds bcrypt byte limit'; end if;
  if v_kind not in ('standard','focused_value_chain') then raise exception 'Invalid data' using errcode='23514'; end if;
  select id into v_account_id from public.accounts where mobile=p_payload->>'mobile';
  if v_account_id is not null then
    select * into v_person from public.persons where account_id=v_account_id for update;
    if v_person.id is null or not exists(select 1 from public.accounts a join private.person_identifiers i on i.person_id=v_person.id
      where a.id=v_account_id and a.status<>'disabled'
      and a.password_hash=extensions.crypt(p_payload->>'password',a.password_hash)
      and i.aadhar_fingerprint=p_payload->>'aadhar_fingerprint') then
      raise exception 'An account already exists for this mobile number';
    end if;
    select * into v_existing from public.registrations where person_id=v_person.id and membership_type=v_kind;
    if v_existing.id is not null then
      if v_existing.onboarding_employee_id is distinct from nullif(p_payload->>'onboarding_employee_id','')::uuid and p_actor_id is distinct from v_account_id then
        raise exception 'An account already exists for this mobile number';
      end if;
      return jsonb_build_object('id',v_existing.id,'reference',v_existing.reference,'amountPaise',v_existing.fee_amount_paise,'status',v_existing.status,'membershipType',v_existing.membership_type);
    end if;
    if p_actor_id is distinct from v_account_id or not exists(select 1 from public.accounts where id=v_account_id and status='active') then
      raise exception 'Sign in to add another membership';
    end if;
    if row(v_person.name,v_person.date_of_birth,v_person.village,v_person.district,v_person.taluka,v_person.income_source)
      is distinct from row(trim(p_payload->>'name'),(p_payload->>'date_of_birth')::date,trim(p_payload->>'village'),p_payload->>'district',p_payload->>'taluka',p_payload->>'income_source') then
      raise exception 'Existing member details must match';
    end if;
    v_person_id:=v_person.id;
  end if;
  if (p_payload->>'mobile') !~ '^[0-9]{10}$' or char_length(p_payload->>'password') < 8 then
    raise exception 'A valid mobile number and password of at least 8 characters are required';
  end if;
  if (p_payload->>'aadhar_fingerprint') !~ '^[0-9a-f]{64}$' then raise exception 'Invalid identity data'; end if;
  if coalesce((p_payload->>'consent')::boolean,false) is not true then raise exception 'Consent is required'; end if;
  if jsonb_typeof(p_payload->'plots') is distinct from 'array' then raise exception 'One to ten plots are required'; end if;
  if jsonb_array_length(p_payload->'plots') not between 1 and 10 then raise exception 'One to ten plots are required'; end if;
  if v_person_id is null and exists(select 1 from private.person_identifiers where aadhar_fingerprint=p_payload->>'aadhar_fingerprint') then raise exception 'An account already exists for this Aadhaar number'; end if;

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

  select * into v_fee from public.fee_versions where membership_type=v_kind and effective_from<=now() and (effective_to is null or effective_to>now()) order by effective_from desc limit 1;
  select * into v_rate from public.commission_rate_versions where effective_from<=now() and (effective_to is null or effective_to>now()) order by effective_from desc limit 1;
  if v_fee.id is null or v_rate.id is null then raise exception 'Registration pricing is not configured'; end if;
  if p_payload?'expected_fee_paise' and (p_payload->>'expected_fee_paise')::integer is distinct from v_fee.amount_paise then raise exception 'Registration fee changed'; end if;

  if v_person_id is null then
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

  end if;
  if exists(select 1 from public.referrer_profiles where id=v_referrer_id and account_id=v_account_id) then raise exception 'Self-referral is not allowed'; end if;
  v_reference := 'REG-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.registration_reference_seq')::text,6,'0');
  insert into public.registrations(reference,person_id,membership_type,cluster_type,fee_version_id,fee_amount_paise,commission_rate_id,commission_basis_points,channel,payment_mode,onboarding_employee_id,referrer_profile_id,consent_given)
  values(v_reference,v_person_id,v_kind,p_payload->>'cluster_type',v_fee.id,v_fee.amount_paise,v_rate.id,v_rate.basis_points,
    case when v_employee_id is null then 'public' else 'employee_assisted' end,
    case when v_employee_id is not null and coalesce((p_payload->>'cash_received')::boolean,false) then 'employee_cash_assisted' else 'farmer_online' end,
    v_employee_id,v_referrer_id,true) returning id into v_registration_id;

  for v_plot in select * from jsonb_array_elements(p_payload->'plots') loop
    v_crops := case when v_plot?'crop_names' then array(select jsonb_array_elements_text(v_plot->'crop_names')) else array[trim(v_plot->>'crop_name')] end;
    v_irrigation := case when v_plot?'irrigation_sources' then array(select jsonb_array_elements_text(v_plot->'irrigation_sources')) else array[v_plot->>'irrigation_source'] end;
    if v_kind='focused_value_chain' and (
      not private.valid_plot_choices(v_crops,6) or
      not (v_crops <@ case p_payload->>'cluster_type' when 'fruits' then array['डाळिंब','आंबा','पेरू','पपई'] when 'allied' then array['कुक्कुटपालन','शेळी पालन'] else array[]::text[] end)
    ) then raise exception 'Invalid focused membership crop' using errcode='23514'; end if;
    insert into public.registration_plots(registration_id,plot_no,area_acres,crop_name,irrigation_source,crop_names,irrigation_sources)
    values(v_registration_id,trim(v_plot->>'plot_no'),(v_plot->>'area_acres')::numeric,v_crops[1],v_irrigation[1],v_crops,v_irrigation);
  end loop;
  if v_employee_id is not null and coalesce((p_payload->>'cash_received')::boolean,false) then
    insert into public.cash_collections(registration_id,employee_id,amount_paise,note)
    values(v_registration_id,v_employee_id,v_fee.amount_paise,nullif(trim(p_payload->>'cash_note'),''));
  end if;
  insert into public.audit_events(actor_account_id,action,target_type,target_id,details)
  values(v_employee_id,'registration_created','registration',v_registration_id::text,jsonb_build_object('channel',case when v_employee_id is null then 'public' else 'employee_assisted' end));
  return jsonb_build_object('id',v_registration_id,'reference',v_reference,'amountPaise',v_fee.amount_paise,'status','payment_pending','membershipType',v_kind);
end;
$function$

;

-- Legacy callers remain standard and retain retry compatibility.
create or replace function public.create_registration(p_payload jsonb) returns jsonb
language sql security definer set search_path='' as $$
 select public.create_membership_registration(p_payload||jsonb_build_object('membership_type','standard'),null);
$$;


create or replace function public.finalize_registration_payment(
  p_provider_order_id text,p_provider_payment_id text,p_amount_paise integer,p_currency text,p_payer_kind text,p_signature_verified boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_order public.payment_orders; v_reg public.registrations; v_person public.persons;
  v_attempt_id uuid; v_farmer_id uuid; v_membership_id uuid; v_receipt_token uuid;
  v_membership_number text; v_receipt_number text;
begin
  if p_signature_verified is distinct from true then raise exception 'Payment signature is not verified'; end if;
  select * into v_order from public.payment_orders where provider_order_id=p_provider_order_id;
  if not found then raise exception 'Payment order not found'; end if;
  if v_order.amount_paise<>p_amount_paise or v_order.currency<>p_currency then raise exception 'Payment amount or currency does not match'; end if;
  select * into v_reg from public.registrations where id=v_order.registration_id for update;
  -- Event/attempt inserts hold FK KEY SHARE locks; we do not change the order key.
  select * into v_order from public.payment_orders where id=v_order.id for no key update;
  if p_amount_paise is null or p_currency is null or p_provider_payment_id is null then raise exception 'Invalid payment'; end if;
  insert into public.payment_attempts(payment_order_id,provider_payment_id,amount_paise,currency,status,payer_kind,signature_verified,captured_at)
  values(v_order.id,p_provider_payment_id,p_amount_paise,p_currency,'captured',case when v_reg.payment_mode='employee_cash_assisted' then 'employee' else 'farmer' end,true,now())
  on conflict(provider_payment_id) do nothing returning id into v_attempt_id;
  if v_attempt_id is null then
    select id into v_attempt_id from public.payment_attempts where provider_payment_id=p_provider_payment_id
      and payment_order_id=v_order.id and amount_paise=p_amount_paise and currency=p_currency and status='captured';
    if v_attempt_id is null then raise exception 'Payment belongs to a different order or state'; end if;
  end if;
  update public.payment_orders set status='paid',paid_at=coalesce(paid_at,now()) where id=v_order.id;
  if v_reg.status='completed' and not exists(select 1 from public.receipts where registration_id=v_reg.id and payment_attempt_id=v_attempt_id) then
    insert into public.audit_events(action,target_type,target_id,details)
    select 'additional_capture_requires_review','payment_attempt',v_attempt_id::text,'{}'::jsonb
    where not exists(select 1 from public.audit_events where action='additional_capture_requires_review' and target_id=v_attempt_id::text);
    return jsonb_build_object('paymentException',true,'registrationId',v_reg.id);
  end if;
  if v_reg.status='completed' then
    return (select jsonb_build_object('registrationId',v_reg.id,'reference',v_reg.reference,'membershipNumber',m.membership_number,'receiptToken',r.public_token,'alreadyCompleted',true)
      from public.memberships m join public.receipts r on r.membership_id=m.id where m.registration_id=v_reg.id);
  end if;
  -- Preserve verified late capture evidence, but never recreate an erased profile.
  if v_reg.erased_at is not null then
    update public.registrations set status='payment_exception' where id=v_reg.id;
    insert into public.audit_events(action,target_type,target_id,details)
    select 'payment_verification_requires_review','payment_attempt',v_attempt_id::text,jsonb_build_object('reason','registration_erased')
    where not exists(select 1 from public.audit_events where action='payment_verification_requires_review' and target_id=v_attempt_id::text);
    return jsonb_build_object('paymentException',true,'registrationId',v_reg.id);
  end if;
  select * into v_person from public.persons where id=v_reg.person_id for update;
  update public.registrations set status='processing' where id=v_reg.id;
  insert into public.farmers(person_id,registration_id,onboarding_employee_id)
  values(v_reg.person_id,v_reg.id,v_reg.onboarding_employee_id) on conflict(person_id) do nothing returning id into v_farmer_id;
  if v_farmer_id is null then select id into v_farmer_id from public.farmers where person_id=v_reg.person_id; end if;
  insert into public.farmer_plots(farmer_id,source_registration_plot_id,plot_no,area_acres,crop_name,irrigation_source,crop_names,irrigation_sources)
  select v_farmer_id,id,plot_no,area_acres,crop_name,irrigation_source,crop_names,irrigation_sources from public.registration_plots where registration_id=v_reg.id;
  v_membership_number := 'GA-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.membership_number_seq')::text,6,'0');
  insert into public.memberships(membership_number,farmer_id,registration_id,membership_type)
  values(v_membership_number,v_farmer_id,v_reg.id,v_reg.membership_type) returning id into v_membership_id;
  if v_reg.referrer_profile_id is not null then
    insert into public.referral_earnings(registration_id,referrer_profile_id,fee_amount_paise,basis_points,amount_paise)
    values(v_reg.id,v_reg.referrer_profile_id,v_reg.fee_amount_paise,v_reg.commission_basis_points,
      (v_reg.fee_amount_paise::bigint*v_reg.commission_basis_points/10000)::integer);
  end if;
  v_receipt_number := 'RCP-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.receipt_number_seq')::text,6,'0');
  insert into public.receipts(receipt_number,registration_id,payment_attempt_id,membership_id,amount_paise,member_name,member_mobile_masked)
  values(v_receipt_number,v_reg.id,v_attempt_id,v_membership_id,v_reg.fee_amount_paise,v_person.name,'******'||right(v_person.mobile,4))
  returning public_token into v_receipt_token;
  update public.registrations set status='completed',completed_at=now() where id=v_reg.id;
  update public.accounts set status='active',updated_at=now() where id=v_person.account_id and status='pending_payment';
  insert into public.audit_events(action,target_type,target_id,details)
  values('payment_finalized','registration',v_reg.id::text,jsonb_build_object('payment_order_id',v_order.id,'membership_number',v_membership_number));
  return jsonb_build_object('registrationId',v_reg.id,'reference',v_reg.reference,'membershipNumber',v_membership_number,'receiptToken',v_receipt_token,'alreadyCompleted',false);
end;
$$;

create or replace function public.get_checkout(p_registration_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',g.id,'reference',g.reference,'membershipType',g.membership_type,'amountPaise',g.fee_amount_paise,'status',g.status,'erasedAt',g.erased_at,
    'providerOrderId',(select provider_order_id from public.payment_orders where registration_id=g.id order by created_at desc limit 1),
    'receiptToken',(select public_token from public.receipts where registration_id=g.id))
  from public.registrations g where g.id=p_registration_id;
$$;

create or replace function public.get_receipt(p_public_token uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('receiptNumber',r.receipt_number,'registrationReference',g.reference,'membershipNumber',m.membership_number,'membershipType',m.membership_type,
    'memberName',r.member_name,'memberMobile',r.member_mobile_masked,'amountPaise',r.amount_paise,'currency',r.currency,
    'paymentId',pa.provider_payment_id,'issuedAt',r.issued_at)
  from public.receipts r join public.registrations g on g.id=r.registration_id
  join public.memberships m on m.id=r.membership_id join public.payment_attempts pa on pa.id=r.payment_attempt_id
  where r.public_token=p_public_token;
$$;

create or replace function public.get_admin_registration(p_actor_id uuid,p_registration_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.has_role(p_actor_id,array['manager','super_admin']) then raise exception 'Not authorized'; end if;
 select jsonb_build_object('id',g.id,'reference',g.reference,'membershipType',g.membership_type,'name',coalesce(p.name,'Deleted farmer'),'mobileMasked','******'||right(p.mobile,4),'status',g.status,'amountPaise',g.fee_amount_paise,'createdAt',g.created_at,'completedAt',g.completed_at,'employee',a.display_name,'referralCode',rp.referral_code,'paymentMode',g.payment_mode,'farmerId',f.id,'membership',m.membership_number,'receiptNumber',r.receipt_number,'receiptToken',r.public_token,
  'orders',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'providerOrderId',o.provider_order_id,'amountPaise',o.amount_paise,'status',o.status,'createdAt',o.created_at,'paidAt',o.paid_at,'payments',coalesce((select jsonb_agg(jsonb_build_object('paymentId',pa.provider_payment_id,'amountPaise',pa.amount_paise,'status',pa.status,'capturedAt',pa.captured_at)) from public.payment_attempts pa where pa.payment_order_id=o.id),'[]'::jsonb))) from public.payment_orders o where o.registration_id=g.id),'[]'::jsonb)) into result
 from public.registrations g left join public.persons p on p.id=g.person_id left join public.accounts a on a.id=g.onboarding_employee_id left join public.referrer_profiles rp on rp.id=g.referrer_profile_id left join public.farmers f on f.person_id=g.person_id left join public.memberships m on m.registration_id=g.id left join public.receipts r on r.registration_id=g.id where g.id=p_registration_id;
 return result;
end; $$;

create or replace function public.get_admin_record(p_actor_id uuid,p_registration_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; extra jsonb;
begin
 result:=public.get_admin_registration(p_actor_id,p_registration_id);
 if result is null then return null; end if;
 select jsonb_build_object('mobile',case when private.has_role(p_actor_id,array['super_admin']) then p.mobile else '******'||right(p.mobile,4) end,'dateOfBirth',p.date_of_birth,'village',p.village,'district',p.district,'taluka',p.taluka,'incomeSource',p.income_source,'clusterType',coalesce(g.cluster_type,p.cluster_type),'consentGiven',g.consent_given,'channel',g.channel,'commissionBasisPoints',g.commission_basis_points,'accountStatus',ac.status,'aadhaarLastFour',case when private.has_role(p_actor_id,array['super_admin']) then pi.aadhar_last_four else null end,
 'archivedAt',ar.archived_at,'archiveReason',ar.reason,'archivedBy',archiver.display_name,
 'cash',case when c.id is null then null else jsonb_build_object('amountPaise',c.amount_paise,'receivedAt',c.received_at,'note',c.note) end,
 'plots',coalesce((select jsonb_agg(jsonb_build_object('id',pl.id,'plotNo',pl.plot_no,'areaAcres',pl.area_acres,'cropName',pl.crop_name,'irrigationSource',pl.irrigation_source,'cropNames',pl.crop_names,'irrigationSources',pl.irrigation_sources) order by pl.created_at,pl.id) from public.registration_plots pl where pl.registration_id=g.id),'[]'::jsonb)) into extra
 from public.registrations g join public.persons p on p.id=g.person_id join public.accounts ac on ac.id=p.account_id left join private.person_identifiers pi on pi.person_id=p.id left join public.cash_collections c on c.registration_id=g.id left join private.registration_archives ar on ar.registration_id=g.id left join public.accounts archiver on archiver.id=ar.archived_by where g.id=p_registration_id;
 return result||extra;
end; $$;

create or replace function public.get_farmer_detail(p_actor_id uuid,p_farmer_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_fields text[]; v_can_view boolean;
begin
  if not private.has_role(p_actor_id,array['employee','manager','super_admin']) then raise exception 'Not authorized'; end if;
  select coalesce(array_agg(distinct field),array[]::text[]) into v_fields
  from public.temporary_permission_grants g cross join unnest(g.allowed_fields) field
  where g.employee_id=p_actor_id and g.farmer_id=p_farmer_id and g.revoked_at is null and g.expires_at>now();
  v_can_view := private.has_role(p_actor_id,array['manager','super_admin']) or exists(select 1 from public.farmers where id=p_farmer_id and onboarding_employee_id=p_actor_id);
  if not v_can_view then raise exception 'Not authorized'; end if;
  return (select jsonb_build_object('id',f.id,'name',p.name,'mobileMasked','******'||right(p.mobile,4),'dateOfBirth',p.date_of_birth,
    'village',p.village,'district',p.district,'taluka',p.taluka,'incomeSource',p.income_source,'clusterType',p.cluster_type,
    'membershipNumber',(select membership_number from public.memberships where farmer_id=f.id order by activated_at,id limit 1),
    'memberships',coalesce((select jsonb_agg(jsonb_build_object('type',membership_type,'number',membership_number,'status',status) order by activated_at,id) from public.memberships where farmer_id=f.id),'[]'::jsonb),'editableFields',case when private.has_role(p_actor_id,array['manager','super_admin']) then
      array['name','date_of_birth','village','district','taluka','income_source','cluster_type'] else v_fields end,
    'plots',coalesce((select jsonb_agg(jsonb_build_object('id',fp.id,'membershipType',(select g.membership_type from public.registration_plots rp join public.registrations g on g.id=rp.registration_id where rp.id=fp.source_registration_plot_id),'plotNo',fp.plot_no,'areaAcres',fp.area_acres,'cropName',fp.crop_name,'irrigationSource',fp.irrigation_source,'cropNames',fp.crop_names,'irrigationSources',fp.irrigation_sources)) from public.farmer_plots fp where fp.farmer_id=f.id),'[]'::jsonb))
    from public.farmers f join public.persons p on p.id=f.person_id where f.id=p_farmer_id);
end;
$$;

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
    'memberships',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'type',g.membership_type,'reference',g.reference,'status',g.status,'amountPaise',g.fee_amount_paise,'number',m.membership_number,'receiptToken',r.public_token) order by g.created_at,g.id)
      from public.registrations g join public.persons p on p.id=g.person_id left join public.memberships m on m.registration_id=g.id left join public.receipts r on r.registration_id=g.id where p.account_id=p_account_id),'[]'::jsonb),
    'roles',to_jsonb(v_roles),'earnedPaise',v_earned,'paidPaise',v_paid,'availablePaise',v_earned-v_paid,
    'referralCode',(select referral_code from public.referrer_profiles where id=v_profile),
    'successfulReferrals',(select count(*) from public.referral_earnings where referrer_profile_id=v_profile),
    'onboardedFarmers',(select count(*) from public.farmers where onboarding_employee_id=p_account_id),
    'cashPending',(select count(*) from public.cash_collections c join public.registrations g on g.id=c.registration_id where c.employee_id=p_account_id and g.erased_at is null and g.status<>'completed'),
    'totalFarmers',case when v_is_ops then (select count(*) from public.farmers) else null end,
    'recentOnboardings',coalesce((select jsonb_agg(x) from (select f.id as "farmerId",g.reference,p.name as "farmerName",'******'||right(p.mobile,4) as "mobileMasked",
      g.payment_mode as "paymentMode",g.completed_at as "completedAt"
      from public.farmers f join public.registrations g on g.id=f.registration_id join public.persons p on p.id=f.person_id
      where f.onboarding_employee_id=p_account_id order by f.created_at desc limit 20) x),'[]'::jsonb),
    'pendingOnboardings',coalesce((select jsonb_agg(x) from (select g.membership_type as "membershipType",g.reference,p.name as "farmerName",g.fee_amount_paise as "amountPaise",g.payment_mode as "paymentMode",g.status from public.registrations g join public.persons p on p.id=g.person_id where g.onboarding_employee_id=p_account_id and g.status<>'completed' order by g.created_at desc limit 20) x),'[]'::jsonb),
    'recentEarnings',coalesce((select jsonb_agg(x) from (select re.amount_paise as "amountPaise",re.credited_at as "creditedAt",coalesce(p.name,'Deleted farmer') as "farmerName",g.reference
      from public.referral_earnings re join public.registrations g on g.id=re.registration_id left join public.persons p on p.id=g.person_id
      where re.referrer_profile_id=v_profile order by re.credited_at desc limit 10) x),'[]'::jsonb),
    'recentPayouts',coalesce((select jsonb_agg(x) from (select amount_paise as "amountPaise",method,payment_reference as "reference",paid_at as "paidAt"
      from public.referral_payouts where referrer_profile_id=v_profile order by paid_at desc limit 10) x),'[]'::jsonb)
  );
end;
$$;

create or replace function public.get_membership_admin_workspace(p_actor_id uuid,p_section text default 'overview',p_query text default '',p_page integer default 1,p_status text default '',p_sort text default 'newest',p_from date default null,p_to date default null,p_size integer default 25,p_membership_type text default '')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; summary jsonb; items jsonb; total bigint; q text:=trim(p_query); off integer;
begin
 if not private.has_role(p_actor_id,array['manager','super_admin']) then raise exception 'Not authorized'; end if;
 if p_membership_type is null or p_membership_type not in ('','standard','focused_value_chain') then raise exception 'Invalid data' using errcode='23514'; end if;
 if p_section is null or p_section not in ('overview','registrations','trash','staff','referrers','payouts','exceptions','grants','audit') or p_page is null or p_page<1 or p_page>10000 or p_size is null or p_size not in (25,50,100) or q is null or length(q)>100 or p_status is null or p_status not in ('','payment_pending','processing','completed','payment_exception') or p_sort is null or p_sort not in ('newest','oldest','name') or (p_from is not null and p_to is not null and p_from>p_to) then raise exception 'Invalid data' using errcode='23514'; end if;
 if p_section='trash' and not private.has_role(p_actor_id,array['super_admin']) then raise exception 'Not authorized'; end if;
 if p_section not in ('overview','registrations','trash') then return public.get_admin_page(p_actor_id,p_section,q,p_page); end if;
 select jsonb_build_object('standard',count(*) filter(where membership_type='standard'),'focused',count(*) filter(where membership_type='focused_value_chain'),'total',count(*),'completed',count(*) filter(where status='completed'),'pending',count(*) filter(where status<>'completed'),'today',count(*) filter(where created_at>=(now() at time zone 'Asia/Kolkata')::date at time zone 'Asia/Kolkata'),'trash',(select count(*) from private.registration_archives)) into summary from public.registrations where erased_at is null;
 off:=(p_page-1)*p_size;
 select count(*) into total from public.registrations g join public.persons p on p.id=g.person_id
 where (exists(select 1 from private.registration_archives ar where ar.registration_id=g.id))=(p_section='trash')
 and (q='' or p.name ilike q||'%' or p.mobile=q or g.reference ilike q||'%')
 and (p_membership_type='' or g.membership_type=p_membership_type) and (p_status='' or g.status=p_status) and (p_from is null or g.created_at>=p_from::timestamp at time zone 'Asia/Kolkata') and (p_to is null or g.created_at<(p_to+1)::timestamp at time zone 'Asia/Kolkata');
 execute format($list$select coalesce(jsonb_agg(x),'[]') from (
  select g.id,g.membership_type as "membershipType",p.name as label,g.reference,g.status,g.fee_amount_paise as "amountPaise",g.created_at as "createdAt",case when $1 then p.mobile else '******'||right(p.mobile,4) end as mobile,f.id as "farmerId",a.display_name as actor,p.village,p.district,ar.archived_at as "archivedAt"
  from public.registrations g join public.persons p on p.id=g.person_id left join public.farmers f on f.person_id=g.person_id left join public.accounts a on a.id=g.onboarding_employee_id left join private.registration_archives ar on ar.registration_id=g.id
  where (ar.registration_id is not null)=($2='trash') and ($3='' or p.name ilike $3||'%%' or p.mobile=$3 or g.reference ilike $3||'%%')
  and ($9='' or g.membership_type=$9) and ($4='' or g.status=$4) and ($5 is null or g.created_at>=$5::timestamp at time zone 'Asia/Kolkata') and ($6 is null or g.created_at<($6+1)::timestamp at time zone 'Asia/Kolkata')
  order by %s,g.id desc
  limit case when $2='overview' then 6 else $7 end offset $8
 ) x$list$,case p_sort when 'name' then 'p.name ASC' when 'oldest' then 'g.created_at ASC' else 'g.created_at DESC' end) into items using private.has_role(p_actor_id,array['super_admin']),p_section,q,p_status,p_from,p_to,p_size,off,p_membership_type; return jsonb_build_object('summary',summary,'rows',items,'total',total,'page',p_page,'hasNext',p_section<>'overview' and total>off+p_size);
end; $$;

create or replace function public.get_admin_workspace(p_actor_id uuid,p_section text default 'overview',p_query text default '',p_page integer default 1,p_status text default '',p_sort text default 'newest',p_from date default null,p_to date default null,p_size integer default 25)
returns jsonb language sql stable security definer set search_path='' as $$
 select public.get_membership_admin_workspace(p_actor_id,p_section,p_query,p_page,p_status,p_sort,p_from,p_to,p_size,'');
$$;

create function public.delete_membership_registrations(p_actor_id uuid,p_ids uuid[],p_all boolean,p_query text,p_status text,p_from date,p_to date,p_expected integer,p_reason text,p_password text,p_membership_type text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare targets uuid[]; actual integer; changed integer; saved_hash text;
begin
 if not private.has_role(p_actor_id,array['super_admin']) then raise exception 'Not authorized'; end if;
 if p_membership_type is null or p_membership_type not in ('','standard','focused_value_chain') then raise exception 'Invalid data' using errcode='23514'; end if;
 if p_all is null or p_ids is null or p_query is null or length(p_query)>100 or p_status is null or p_status not in ('','payment_pending','processing','completed','payment_exception') or p_reason is null or length(trim(p_reason))<3 or length(p_reason)>300 or (p_from is not null and p_to is not null and p_from>p_to) or array_position(p_ids,null) is not null or (p_all and (cardinality(p_ids)<>0 or p_expected is null or p_expected<1)) or (not p_all and cardinality(p_ids) not between 1 and 100) then raise exception 'Invalid data' using errcode='23514'; end if;
 -- Lock matching registrations in a consistent order, then validate the actual count.
 select coalesce(array_agg(selected.id),'{}'::uuid[]) into targets from (
  select g.id from public.registrations g join public.persons p on p.id=g.person_id
  where (not p_all and g.id=any(p_ids)) or (p_all
   and not exists(select 1 from private.registration_archives ar where ar.registration_id=g.id)
   and (p_query='' or p.name ilike p_query||'%' or p.mobile=p_query or g.reference ilike p_query||'%')
   and (p_membership_type='' or g.membership_type=p_membership_type) and (p_status='' or g.status=p_status)
   and (p_from is null or g.created_at>=p_from::timestamp at time zone 'Asia/Kolkata')
   and (p_to is null or g.created_at<(p_to+1)::timestamp at time zone 'Asia/Kolkata'))
  order by g.id for update of g
 ) selected;
 actual:=cardinality(targets);
 if p_all and actual<>p_expected then raise exception 'Selection changed'; end if;
 if not p_all and actual<>(select count(distinct id) from unnest(p_ids) id) then raise exception 'Invalid data' using errcode='23514'; end if;
 if p_all or actual>25 then
  if p_password is null or length(p_password)=0 then raise exception 'Password confirmation required'; end if;
  if octet_length(p_password)>72 then raise exception 'Incorrect confirmation password'; end if;
  select password_hash into saved_hash from public.accounts where id=p_actor_id and status='active' for share;
  if saved_hash is null or extensions.crypt(p_password,saved_hash)<>saved_hash then raise exception 'Incorrect confirmation password'; end if;
 end if;
 with inserted as (
  insert into private.registration_archives(registration_id,archived_by,reason)
  select id,p_actor_id,trim(p_reason) from unnest(targets) id on conflict do nothing returning registration_id
 ), audited as (
  insert into public.audit_events(actor_account_id,action,target_type,target_id)
  select p_actor_id,'registration_trashed','registration',registration_id::text from inserted returning id
 ) select count(*) into changed from audited;
 return jsonb_build_object('changed',changed);
end; $$;

create or replace function public.delete_admin_registrations(p_actor_id uuid,p_ids uuid[],p_all boolean,p_query text,p_status text,p_from date,p_to date,p_expected integer,p_reason text,p_password text)
returns jsonb language sql security definer set search_path='' as $$
 select public.delete_membership_registrations(p_actor_id,p_ids,p_all,p_query,p_status,p_from,p_to,p_expected,p_reason,p_password,'');
$$;

create or replace function public.purge_admin_registrations(p_actor_id uuid,p_ids uuid[],p_password text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item uuid; g public.registrations; person uuid; account uuid; saved_hash text; changed integer:=0; sibling public.registrations;
begin
 if not private.has_role(p_actor_id,array['super_admin']) then raise exception 'Not authorized'; end if;
 if p_ids is null or cardinality(p_ids) not between 1 and 100 or array_position(p_ids,null) is not null then raise exception 'Invalid data' using errcode='23514'; end if;
 if p_password is null or length(p_password)=0 then raise exception 'Password confirmation required'; end if;
 if octet_length(p_password)>72 then raise exception 'Incorrect confirmation password'; end if;
 select password_hash into saved_hash from public.accounts where id=p_actor_id and status='active' for share;
 if saved_hash is null or extensions.crypt(p_password,saved_hash)<>saved_hash then raise exception 'Incorrect confirmation password'; end if;

 -- Same registration locks as checkout, capture and restore. Failure rolls back
 -- the entire selection. Existing audit events make response-loss retries safe.
 perform 1 from public.registrations where id=any(p_ids) order by id for update;
 for item in select distinct unnest(p_ids) order by 1 loop
  select * into g from public.registrations where id=item for update;
  if not found or g.erased_at is not null then
   if exists(select 1 from public.audit_events where action='registration_permanently_deleted' and target_type='registration' and target_id=item::text) then continue; end if;
   raise exception 'Selection changed';
  end if;
  perform 1 from private.registration_archives where registration_id=item for update;
  if not found then raise exception 'Only trashed registrations can be permanently deleted'; end if;
  person:=g.person_id;
  select account_id into account from public.persons where id=person for update;
  perform 1 from public.accounts where id=account for update;
  if exists(select 1 from public.registrations where person_id=person and not(id=any(p_ids))) then
   raise exception 'Select all memberships before permanent deletion';
  end if;
  if exists(select 1 from public.registrations r where r.person_id=person and not exists(select 1 from private.registration_archives a where a.registration_id=r.id)) then
   raise exception 'Only trashed registrations can be permanently deleted';
  end if;
  if account=p_actor_id or exists(select 1 from public.account_roles where account_id=account and role<>'farmer_referrer') then
   raise exception 'Staff accounts cannot be permanently deleted';
  end if;
  update public.referrer_profiles set active=false where account_id=account;
  delete from private.account_sessions where account_id=account;
  delete from public.account_roles where account_id=account;
  update public.accounts set mobile=null,display_name='Deleted farmer',password_hash='!erased',status='disabled',erased_at=now(),updated_at=now() where id=account;
  update public.temporary_permission_grants set revoked_at=coalesce(revoked_at,now()),revoked_by=coalesce(revoked_by,p_actor_id)
   where farmer_id in(select id from public.farmers where person_id=person);
  delete from public.farmer_plots where farmer_id in(select id from public.farmers where person_id=person);
  delete from public.registration_plots where registration_id in(select id from public.registrations where person_id=person);
  delete from private.person_identifiers where person_id=person;
  update public.farmers set person_id=null,erased_at=now(),updated_at=now() where person_id=person;
  for sibling in select * from public.registrations where person_id=person order by id loop
   delete from private.registration_archives where registration_id=sibling.id;
   if sibling.status='completed'
     or exists(select 1 from private.checkout_orders where registration_id=sibling.id)
     or exists(select 1 from public.payment_orders where registration_id=sibling.id)
     or exists(select 1 from public.cash_collections where registration_id=sibling.id) then
    update public.registrations set person_id=null,erased_at=now() where id=sibling.id;
   else
    delete from public.registrations where id=sibling.id;
   end if;
   insert into public.audit_events(actor_account_id,action,target_type,target_id,details)
    values(p_actor_id,'registration_permanently_deleted','registration',sibling.id::text,jsonb_build_object('financialHistoryRetained',true));
   changed:=changed+1;
  end loop;
  delete from public.persons where id=person;
 end loop;
 return jsonb_build_object('changed',changed);
end; $$;

revoke all on function public.get_membership_fee(text) from public,anon,authenticated;
grant execute on function public.get_membership_fee(text) to service_role;

revoke all on function public.get_membership_form_profile(uuid) from public,anon,authenticated;
grant execute on function public.get_membership_form_profile(uuid) to service_role;

revoke all on function public.create_membership_registration(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.create_membership_registration(jsonb,uuid) to service_role;

revoke all on function public.get_membership_admin_workspace(uuid,text,text,integer,text,text,date,date,integer,text) from public,anon,authenticated;
grant execute on function public.get_membership_admin_workspace(uuid,text,text,integer,text,text,date,date,integer,text) to service_role;

revoke all on function public.delete_membership_registrations(uuid,uuid[],boolean,text,text,date,date,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.delete_membership_registrations(uuid,uuid[],boolean,text,text,date,date,integer,text,text,text) to service_role;

revoke all on function public.create_registration(jsonb) from public,anon,authenticated;
grant execute on function public.create_registration(jsonb) to service_role;

revoke all on function public.get_registration_fee() from public,anon,authenticated;
grant execute on function public.get_registration_fee() to service_role;

revoke all on function public.finalize_registration_payment(text,text,integer,text,text,boolean) from public,anon,authenticated;
grant execute on function public.finalize_registration_payment(text,text,integer,text,text,boolean) to service_role;

revoke all on function public.get_checkout(uuid) from public,anon,authenticated;
grant execute on function public.get_checkout(uuid) to service_role;

revoke all on function public.get_receipt(uuid) from public,anon,authenticated;
grant execute on function public.get_receipt(uuid) to service_role;

revoke all on function public.get_admin_registration(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_admin_registration(uuid,uuid) to service_role;

revoke all on function public.get_admin_record(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_admin_record(uuid,uuid) to service_role;

revoke all on function public.get_farmer_detail(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_farmer_detail(uuid,uuid) to service_role;

revoke all on function public.get_dashboard(uuid) from public,anon,authenticated;
grant execute on function public.get_dashboard(uuid) to service_role;

revoke all on function public.get_admin_workspace(uuid,text,text,integer,text,text,date,date,integer) from public,anon,authenticated;
grant execute on function public.get_admin_workspace(uuid,text,text,integer,text,text,date,date,integer) to service_role;

revoke all on function public.delete_admin_registrations(uuid,uuid[],boolean,text,text,date,date,integer,text,text) from public,anon,authenticated;
grant execute on function public.delete_admin_registrations(uuid,uuid[],boolean,text,text,date,date,integer,text,text) to service_role;

revoke all on function public.purge_admin_registrations(uuid,uuid[],text) from public,anon,authenticated;
grant execute on function public.purge_admin_registrations(uuid,uuid[],text) to service_role;

notify pgrst, 'reload schema';
commit;
