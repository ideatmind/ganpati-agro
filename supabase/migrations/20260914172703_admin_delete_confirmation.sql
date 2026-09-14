begin;
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
CREATE OR REPLACE FUNCTION public.create_staff_account(p_actor_id uuid, p_name text, p_mobile text, p_password text, p_role text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid; v_code text;
begin
  if not private.has_role(p_actor_id,array['super_admin']) then raise exception 'Only a super admin can create staff accounts'; end if;
  if p_role not in ('employee','manager') then raise exception 'Invalid staff role'; end if;
  if (p_mobile !~ '^[0-9]{10}$' or char_length(p_mobile)<>10) or char_length(p_password)<8 or octet_length(p_password)>72 then raise exception 'Valid mobile and password are required'; end if;
  insert into public.accounts(mobile,password_hash,display_name,status)
  values(trim(p_mobile),extensions.crypt(p_password,extensions.gen_salt('bf',12)),trim(p_name),'active') returning id into v_id;
  insert into public.account_roles(account_id,role) values(v_id,p_role);
  if p_role='employee' then
    insert into public.referrer_profiles(account_id,referral_code)
    values(v_id,'GA'||upper(substr(replace(v_id::text,'-',''),1,8))) returning referral_code into v_code;
  end if;
  insert into public.audit_events(actor_account_id,action,target_type,target_id,details)
  values(p_actor_id,'staff_created','account',v_id::text,jsonb_build_object('role',p_role));
  return jsonb_build_object('id',v_id,'displayName',trim(p_name),'mobile',trim(p_mobile),'role',p_role,'referralCode',v_code);
end;
$function$

;
CREATE OR REPLACE FUNCTION public.change_account_password(p_account_id uuid, p_current_password text, p_new_password text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if char_length(p_new_password)<8 or octet_length(p_new_password)>72 then raise exception 'Invalid password length'; end if;
  perform 1 from public.accounts where id=p_account_id and status='active'
    and password_hash=extensions.crypt(p_current_password,password_hash) for update;
  if not found then raise exception 'Not authorized'; end if;
  update public.accounts set password_hash=extensions.crypt(p_new_password,extensions.gen_salt('bf',12)),updated_at=now() where id=p_account_id;
  update private.account_sessions set revoked_at=now() where account_id=p_account_id and revoked_at is null;
  insert into public.audit_events(actor_account_id,action,target_type,target_id) values(p_account_id,'password_changed','account',p_account_id::text);
end;
$function$

;
CREATE OR REPLACE FUNCTION public.admin_bulk_action(p_actor_id uuid, p_ids uuid[], p_action text, p_reason text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare item uuid; changed integer:=0;
begin
 if not private.has_role(p_actor_id,array['manager','super_admin']) then raise exception 'Not authorized'; end if;
 if p_action is null or p_action not in ('trash','restore','activate','deactivate','revoke') or p_ids is null or cardinality(p_ids)<1 or cardinality(p_ids)>100 or array_position(p_ids,null) is not null then raise exception 'Invalid data' using errcode='23514'; end if;
 if p_action<>'revoke' and not private.has_role(p_actor_id,array['super_admin']) then raise exception 'Not authorized'; end if;
 if p_action='trash' and (p_reason is null or length(trim(p_reason))<3 or length(p_reason)>300) then raise exception 'Invalid data' using errcode='23514'; end if;
 if p_action='trash' and cardinality(p_ids)>25 then raise exception 'Password confirmation required'; end if;
 -- Sorted locks make concurrent selections deterministic. Any invalid item rolls back the batch.
 for item in select distinct unnest(p_ids) order by 1 loop
  if p_action in ('trash','restore') then
   perform 1 from public.registrations where id=item for update;
   if not found then raise exception 'Invalid data' using errcode='23514'; end if;
   if p_action='trash' then
    insert into private.registration_archives(registration_id,archived_by,reason) values(item,p_actor_id,trim(p_reason)) on conflict do nothing;
   else delete from private.registration_archives where registration_id=item; end if;
   if found then
    changed:=changed+1;
    insert into public.audit_events(actor_account_id,action,target_type,target_id) values(p_actor_id,case when p_action='trash' then 'registration_trashed' else 'registration_restored' end,'registration',item::text);
   end if;
  elsif p_action in ('activate','deactivate') then
   perform public.set_staff_status(p_actor_id,item,case when p_action='activate' then 'active' else 'disabled' end);changed:=changed+1;
  else
   if not exists(select 1 from public.temporary_permission_grants where id=item) then raise exception 'Invalid data' using errcode='23514'; end if;
   perform public.revoke_farmer_grant(p_actor_id,item);changed:=changed+1;
  end if;
 end loop;
 return jsonb_build_object('changed',changed);
end; $function$

;

create function public.delete_admin_registrations(p_actor_id uuid,p_ids uuid[],p_all boolean,p_query text,p_status text,p_from date,p_to date,p_expected integer,p_reason text,p_password text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare targets uuid[]; actual integer; changed integer; saved_hash text;
begin
 if not private.has_role(p_actor_id,array['super_admin']) then raise exception 'Not authorized'; end if;
 if p_all is null or p_ids is null or p_query is null or length(p_query)>100 or p_status is null or p_status not in ('','payment_pending','processing','completed','payment_exception') or p_reason is null or length(trim(p_reason))<3 or length(p_reason)>300 or (p_from is not null and p_to is not null and p_from>p_to) or array_position(p_ids,null) is not null or (p_all and (cardinality(p_ids)<>0 or p_expected is null or p_expected<1)) or (not p_all and cardinality(p_ids) not between 1 and 100) then raise exception 'Invalid data' using errcode='23514'; end if;
 -- Lock matching registrations in a consistent order, then validate the actual count.
 select coalesce(array_agg(selected.id),'{}'::uuid[]) into targets from (
  select g.id from public.registrations g join public.persons p on p.id=g.person_id
  where (not p_all and g.id=any(p_ids)) or (p_all
   and not exists(select 1 from private.registration_archives ar where ar.registration_id=g.id)
   and (p_query='' or p.name ilike p_query||'%' or p.mobile=p_query or g.reference ilike p_query||'%')
   and (p_status='' or g.status=p_status)
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
revoke all on function public.delete_admin_registrations(uuid,uuid[],boolean,text,text,date,date,integer,text,text) from public,anon,authenticated;
grant execute on function public.delete_admin_registrations(uuid,uuid[],boolean,text,text,date,date,integer,text,text) to service_role;
commit;
