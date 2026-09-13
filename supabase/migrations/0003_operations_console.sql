begin;

create or replace function public.get_operations_console(p_actor_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.has_role(p_actor_id,array['manager','super_admin']) then raise exception 'Not authorized'; end if;
  return jsonb_build_object(
    'employees',coalesce((select jsonb_agg(x) from (select a.id,a.display_name as "displayName",a.mobile,a.status,
      (select count(*) from public.farmers f where f.onboarding_employee_id=a.id) as "onboardedFarmers",
      rp.id as "referrerProfileId",rp.referral_code as "referralCode"
      from public.accounts a join public.account_roles ar on ar.account_id=a.id and ar.role='employee'
      left join public.referrer_profiles rp on rp.account_id=a.id order by a.created_at desc) x),'[]'::jsonb),
    'referrers',coalesce((select jsonb_agg(x) from (select rp.id as "profileId",a.display_name as "displayName",a.mobile,rp.referral_code as "referralCode",
      coalesce((select sum(amount_paise) from public.referral_earnings e where e.referrer_profile_id=rp.id),0) as "earnedPaise",
      coalesce((select sum(amount_paise) from public.referral_payouts p where p.referrer_profile_id=rp.id),0) as "paidPaise"
      from public.referrer_profiles rp join public.accounts a on a.id=rp.account_id
      where exists(select 1 from public.referral_earnings e where e.referrer_profile_id=rp.id)
      order by a.display_name) x),'[]'::jsonb),
    'farmers',coalesce((select jsonb_agg(x) from (select f.id,p.name,g.reference,'******'||right(p.mobile,4) as "mobileMasked",
      ae.display_name as "employeeName",f.created_at as "createdAt"
      from public.farmers f join public.persons p on p.id=f.person_id join public.registrations g on g.id=f.registration_id
      left join public.accounts ae on ae.id=f.onboarding_employee_id order by f.created_at desc limit 100) x),'[]'::jsonb)
  );
end;
$$;

create or replace function public.create_staff_account(p_actor_id uuid,p_name text,p_mobile text,p_password text,p_role text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_code text;
begin
  if not private.has_role(p_actor_id,array['super_admin']) then raise exception 'Only a super admin can create staff accounts'; end if;
  if p_role not in ('employee','manager') then raise exception 'Invalid staff role'; end if;
  if trim(p_mobile) !~ '^[0-9]{10}$' or char_length(p_password)<8 then raise exception 'Valid mobile and password are required'; end if;
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
$$;

create or replace function public.record_offline_payout(p_actor_id uuid,p_referrer_profile_id uuid,p_amount_paise integer,p_method text,p_reference text,p_note text,p_paid_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_earned bigint; v_paid bigint; v_id uuid;
begin
  if not private.has_role(p_actor_id,array['manager','super_admin']) then raise exception 'Not authorized'; end if;
  if p_amount_paise<=0 or p_method not in ('cash','upi','bank_transfer','other') then raise exception 'Invalid payout'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_referrer_profile_id::text,0));
  select coalesce(sum(amount_paise),0) into v_earned from public.referral_earnings where referrer_profile_id=p_referrer_profile_id;
  select coalesce(sum(amount_paise),0) into v_paid from public.referral_payouts where referrer_profile_id=p_referrer_profile_id;
  if p_amount_paise>v_earned-v_paid then raise exception 'Payout exceeds available earnings'; end if;
  insert into public.referral_payouts(referrer_profile_id,amount_paise,method,payment_reference,note,paid_at,recorded_by)
  values(p_referrer_profile_id,p_amount_paise,p_method,nullif(trim(p_reference),''),nullif(trim(p_note),''),coalesce(p_paid_at,now()),p_actor_id) returning id into v_id;
  insert into public.audit_events(actor_account_id,action,target_type,target_id,details)
  values(p_actor_id,'offline_payout_recorded','referral_payout',v_id::text,jsonb_build_object('amount_paise',p_amount_paise,'method',p_method));
  return jsonb_build_object('id',v_id);
end;
$$;

create or replace function public.grant_temporary_farmer_edit(p_actor_id uuid,p_employee_id uuid,p_farmer_id uuid,p_allowed_fields text[],p_reason text,p_expires_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_allowed constant text[] := array['name','date_of_birth','village','district','taluka','income_source','cluster_type'];
begin
  if not private.has_role(p_actor_id,array['manager','super_admin']) then raise exception 'Not authorized'; end if;
  if not private.has_role(p_employee_id,array['employee']) then raise exception 'The selected account is not an employee'; end if;
  if p_expires_at<=now() or p_expires_at>now()+interval '7 days' then raise exception 'Grant expiry must be within seven days'; end if;
  if cardinality(p_allowed_fields)=0 or not p_allowed_fields<@v_allowed then raise exception 'Invalid editable fields'; end if;
  insert into public.temporary_permission_grants(employee_id,farmer_id,allowed_fields,reason,granted_by,expires_at)
  values(p_employee_id,p_farmer_id,p_allowed_fields,trim(p_reason),p_actor_id,p_expires_at) returning id into v_id;
  insert into public.audit_events(actor_account_id,action,target_type,target_id,details)
  values(p_actor_id,'temporary_edit_granted','farmer',p_farmer_id::text,jsonb_build_object('grant_id',v_id,'employee_id',p_employee_id,'expires_at',p_expires_at));
  return jsonb_build_object('id',v_id);
end;
$$;

create or replace function public.get_farmer_detail(p_actor_id uuid,p_farmer_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_fields text[]; v_can_view boolean;
begin
  select coalesce(array_agg(distinct field),array[]::text[]) into v_fields
  from public.temporary_permission_grants g cross join unnest(g.allowed_fields) field
  where g.employee_id=p_actor_id and g.farmer_id=p_farmer_id and g.revoked_at is null and g.expires_at>now();
  v_can_view := private.has_role(p_actor_id,array['manager','super_admin']) or exists(select 1 from public.farmers where id=p_farmer_id and onboarding_employee_id=p_actor_id) or cardinality(v_fields)>0;
  if not v_can_view then raise exception 'Not authorized'; end if;
  return (select jsonb_build_object('id',f.id,'name',p.name,'mobileMasked','******'||right(p.mobile,4),'dateOfBirth',p.date_of_birth,
    'village',p.village,'district',p.district,'taluka',p.taluka,'incomeSource',p.income_source,'clusterType',p.cluster_type,
    'membershipNumber',m.membership_number,'editableFields',case when private.has_role(p_actor_id,array['manager','super_admin']) then
      array['name','date_of_birth','village','district','taluka','income_source','cluster_type'] else v_fields end,
    'plots',coalesce((select jsonb_agg(jsonb_build_object('plotNo',fp.plot_no,'areaAcres',fp.area_acres,'cropName',fp.crop_name,'irrigationSource',fp.irrigation_source)) from public.farmer_plots fp where fp.farmer_id=f.id),'[]'::jsonb))
    from public.farmers f join public.persons p on p.id=f.person_id join public.memberships m on m.farmer_id=f.id where f.id=p_farmer_id);
end;
$$;

create or replace function public.update_farmer_profile(p_actor_id uuid,p_farmer_id uuid,p_changes jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_person_id uuid; v_allowed text[]; v_keys text[];
begin
  select person_id into v_person_id from public.farmers where id=p_farmer_id for update;
  if v_person_id is null then raise exception 'Farmer not found'; end if;
  if private.has_role(p_actor_id,array['manager','super_admin']) then
    v_allowed := array['name','date_of_birth','village','district','taluka','income_source','cluster_type'];
  else
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

grant execute on function public.get_operations_console(uuid),public.create_staff_account(uuid,text,text,text,text),
  public.record_offline_payout(uuid,uuid,integer,text,text,text,timestamptz),
  public.grant_temporary_farmer_edit(uuid,uuid,uuid,text[],text,timestamptz),public.get_farmer_detail(uuid,uuid),public.update_farmer_profile(uuid,uuid,jsonb) to service_role;

commit;
