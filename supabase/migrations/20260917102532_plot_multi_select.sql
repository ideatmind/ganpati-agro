begin;
-- Additive rollout: old single-choice RPC inputs remain accepted. Arrays are canonical;
-- scalar columns retain the first selection for the previously deployed UI.
create function private.valid_plot_choices(choices text[], max_choices integer)
returns boolean language sql immutable strict set search_path='' as $$
 select coalesce(array_ndims(choices)=1 and array_lower(choices,1)=1
   and cardinality(choices) between 1 and max_choices
   and cardinality(choices)=(select count(distinct choice) from unnest(choices) choice)
   and not exists(select 1 from unnest(choices) choice where choice is null or char_length(trim(choice)) not between 1 and 100 or choice<>trim(choice)),false);
$$;
revoke all on function private.valid_plot_choices(text[],integer) from public,anon,authenticated;
grant execute on function private.valid_plot_choices(text[],integer) to service_role;

alter table public.registration_plots add column crop_names text[], add column irrigation_sources text[];
update public.registration_plots set crop_names=array[crop_name], irrigation_sources=array[irrigation_source];
alter table public.registration_plots
 alter column crop_names set not null,
 alter column irrigation_sources set not null,
 add constraint registration_plots_crop_names_check check(private.valid_plot_choices(crop_names,18) and crop_name=crop_names[1]),
 add constraint registration_plots_irrigation_sources_check check(private.valid_plot_choices(irrigation_sources,8)
   and irrigation_sources <@ array['well','borewell','canal','drip','sprinkler','rainfed','river','other']::text[]
   and irrigation_source=irrigation_sources[1]);

alter table public.farmer_plots add column crop_names text[], add column irrigation_sources text[];
update public.farmer_plots set crop_names=array[crop_name], irrigation_sources=array[irrigation_source];
alter table public.farmer_plots
 alter column crop_names set not null,
 alter column irrigation_sources set not null,
 add constraint farmer_plots_crop_names_check check(private.valid_plot_choices(crop_names,18) and crop_name=crop_names[1]),
 add constraint farmer_plots_irrigation_sources_check check(private.valid_plot_choices(irrigation_sources,8)
   and irrigation_sources <@ array['well','borewell','canal','drip','sprinkler','rainfed','river','other']::text[]
   and irrigation_source=irrigation_sources[1]);

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
  v_crops text[]; v_irrigation text[];
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
    v_crops := case when v_plot?'crop_names' then array(select jsonb_array_elements_text(v_plot->'crop_names')) else array[trim(v_plot->>'crop_name')] end;
    v_irrigation := case when v_plot?'irrigation_sources' then array(select jsonb_array_elements_text(v_plot->'irrigation_sources')) else array[v_plot->>'irrigation_source'] end;
    insert into public.registration_plots(registration_id,plot_no,area_acres,crop_name,irrigation_source,crop_names,irrigation_sources)
    values(v_registration_id,trim(v_plot->>'plot_no'),(v_plot->>'area_acres')::numeric,v_crops[1],v_irrigation[1],v_crops,v_irrigation);
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
  select * into v_person from public.persons where id=v_reg.person_id;
  update public.registrations set status='processing' where id=v_reg.id;
  insert into public.farmers(person_id,registration_id,onboarding_employee_id)
  values(v_reg.person_id,v_reg.id,v_reg.onboarding_employee_id) returning id into v_farmer_id;
  insert into public.farmer_plots(farmer_id,source_registration_plot_id,plot_no,area_acres,crop_name,irrigation_source,crop_names,irrigation_sources)
  select v_farmer_id,id,plot_no,area_acres,crop_name,irrigation_source,crop_names,irrigation_sources from public.registration_plots where registration_id=v_reg.id;
  v_membership_number := 'GA-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.membership_number_seq')::text,6,'0');
  insert into public.memberships(membership_number,farmer_id,registration_id)
  values(v_membership_number,v_farmer_id,v_reg.id) returning id into v_membership_id;
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
  update public.accounts set status='active',updated_at=now() where id=v_person.account_id;
  insert into public.audit_events(action,target_type,target_id,details)
  values('payment_finalized','registration',v_reg.id::text,jsonb_build_object('payment_order_id',v_order.id,'membership_number',v_membership_number));
  return jsonb_build_object('registrationId',v_reg.id,'reference',v_reg.reference,'membershipNumber',v_membership_number,'receiptToken',v_receipt_token,'alreadyCompleted',false);
end;
$$;

create or replace function public.get_admin_record(p_actor_id uuid,p_registration_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; extra jsonb;
begin
 result:=public.get_admin_registration(p_actor_id,p_registration_id);
 if result is null then return null; end if;
 select jsonb_build_object('mobile',case when private.has_role(p_actor_id,array['super_admin']) then p.mobile else '******'||right(p.mobile,4) end,'dateOfBirth',p.date_of_birth,'village',p.village,'district',p.district,'taluka',p.taluka,'incomeSource',p.income_source,'clusterType',p.cluster_type,'consentGiven',g.consent_given,'channel',g.channel,'commissionBasisPoints',g.commission_basis_points,'accountStatus',ac.status,'aadhaarLastFour',case when private.has_role(p_actor_id,array['super_admin']) then pi.aadhar_last_four else null end,
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
    'membershipNumber',m.membership_number,'editableFields',case when private.has_role(p_actor_id,array['manager','super_admin']) then
      array['name','date_of_birth','village','district','taluka','income_source','cluster_type'] else v_fields end,
    'plots',coalesce((select jsonb_agg(jsonb_build_object('plotNo',fp.plot_no,'areaAcres',fp.area_acres,'cropName',fp.crop_name,'irrigationSource',fp.irrigation_source,'cropNames',fp.crop_names,'irrigationSources',fp.irrigation_sources)) from public.farmer_plots fp where fp.farmer_id=f.id),'[]'::jsonb))
    from public.farmers f join public.persons p on p.id=f.person_id join public.memberships m on m.farmer_id=f.id where f.id=p_farmer_id);
end;
$$;

-- Replacing functions retains ACLs; explicitly keep every privileged entry point service-only.
revoke all on function public.create_registration(jsonb), public.finalize_registration_payment(text,text,integer,text,text,boolean), public.get_admin_record(uuid,uuid), public.get_farmer_detail(uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_registration(jsonb), public.finalize_registration_payment(text,text,integer,text,text,boolean), public.get_admin_record(uuid,uuid), public.get_farmer_detail(uuid,uuid) to service_role;
commit;
