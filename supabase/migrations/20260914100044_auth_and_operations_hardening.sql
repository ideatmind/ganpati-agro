begin;
alter default privileges revoke execute on functions from public, anon, authenticated;

create table private.account_sessions (
  id uuid primary key,
  account_id uuid not null references public.accounts(id),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index account_sessions_account_idx on private.account_sessions(account_id);
create index account_sessions_expiry_idx on private.account_sessions(expires_at);
alter table private.account_sessions enable row level security;

create table private.rate_limits (
  key text primary key check(length(key)=64),
  hits integer not null,
  resets_at timestamptz not null
);
create index rate_limits_expiry_idx on private.rate_limits(resets_at);
alter table private.rate_limits enable row level security;

create or replace function public.consume_rate_limit(p_key text,p_limit integer,p_window_seconds integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare hits integer;
begin
  if p_limit not between 1 and 1000 or p_window_seconds not between 1 and 86400 then raise exception 'Invalid rate limit'; end if;
  delete from private.rate_limits where key in (select key from private.rate_limits where resets_at<now() limit 100);
  insert into private.rate_limits as r(key,hits,resets_at) values(p_key,1,now()+make_interval(secs=>p_window_seconds))
  on conflict(key) do update set hits=case when r.resets_at<=now() then 1 else least(r.hits+1,p_limit+1) end,
    resets_at=case when r.resets_at<=now() then now()+make_interval(secs=>p_window_seconds) else r.resets_at end
  returning r.hits into hits;
  return hits<=p_limit;
end;
$$;

create or replace function public.create_account_session(p_account_id uuid,p_session_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.accounts where id=p_account_id and status='active') then raise exception 'Not authorized'; end if;
  delete from private.account_sessions where id in (select id from private.account_sessions where expires_at<now() limit 100);
  insert into private.account_sessions(id,account_id,expires_at) values(p_session_id,p_account_id,now()+interval '12 hours');
end;
$$;
create or replace function public.resolve_account_session(p_session_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select public.get_account_session(account_id) from private.account_sessions where id=p_session_id and revoked_at is null and expires_at>now();
$$;
create or replace function public.revoke_account_session(p_session_id uuid)
returns void language sql security definer set search_path='' as $$
  update private.account_sessions set revoked_at=coalesce(revoked_at,now()) where id=p_session_id;
$$;
create or replace function public.change_account_password(p_account_id uuid,p_current_password text,p_new_password text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if char_length(p_new_password)<15 or octet_length(p_new_password)>72 then raise exception 'Invalid password length'; end if;
  perform 1 from public.accounts where id=p_account_id and status='active'
    and password_hash=extensions.crypt(p_current_password,password_hash) for update;
  if not found then raise exception 'Not authorized'; end if;
  update public.accounts set password_hash=extensions.crypt(p_new_password,extensions.gen_salt('bf',12)),updated_at=now() where id=p_account_id;
  update private.account_sessions set revoked_at=now() where account_id=p_account_id and revoked_at is null;
  insert into public.audit_events(actor_account_id,action,target_type,target_id) values(p_account_id,'password_changed','account',p_account_id::text);
end;
$$;

create or replace function private.has_role(p_account_id uuid,p_roles text[])
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.account_roles r join public.accounts a on a.id=r.account_id
    where r.account_id=p_account_id and r.role=any(p_roles) and a.status='active');
$$;

-- NOT VALID preserves any historic invalid geography for explicit remediation while enforcing new writes.
alter table public.persons add constraint persons_geography_fk foreign key(district,taluka) references public.talukas(district_code,code) not valid;
create index persons_geography_idx on public.persons(district,taluka);

alter table public.referral_payouts add column idempotency_key uuid;
create unique index referral_payouts_idempotency_idx on public.referral_payouts(idempotency_key) where idempotency_key is not null;
alter function public.record_offline_payout(uuid,uuid,integer,text,text,text,timestamptz) set schema private;
revoke execute on function private.record_offline_payout(uuid,uuid,integer,text,text,text,timestamptz) from service_role,public,anon,authenticated;
create function public.record_offline_payout(p_actor_id uuid,p_referrer_profile_id uuid,p_amount_paise integer,p_method text,p_reference text,p_note text,p_paid_at timestamptz,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing public.referral_payouts; result jsonb;
begin
  if not private.has_role(p_actor_id,array['manager','super_admin']) then raise exception 'Not authorized'; end if;
  if p_idempotency_key is null then raise exception 'Payout idempotency key is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('payout:'||p_idempotency_key::text,0));
  select * into existing from public.referral_payouts where idempotency_key=p_idempotency_key;
  if found then
    if existing.referrer_profile_id<>p_referrer_profile_id or existing.amount_paise<>p_amount_paise or existing.method<>p_method
      or existing.recorded_by<>p_actor_id or existing.payment_reference is distinct from nullif(trim(p_reference),'') or existing.note is distinct from nullif(trim(p_note),'') then
      raise exception 'Idempotency key reused with different payout';
    end if;
    return jsonb_build_object('id',existing.id,'alreadyRecorded',true);
  end if;
  -- Insert the key in the same transaction; an UPDATE would violate append-only history.
  perform pg_advisory_xact_lock(hashtextextended(p_referrer_profile_id::text,0));
  if p_amount_paise<=0 or p_method not in ('cash','upi','bank_transfer','other') then raise exception 'Invalid payout'; end if;
  if p_amount_paise>(select coalesce(sum(amount_paise),0) from public.referral_earnings where referrer_profile_id=p_referrer_profile_id)
    -(select coalesce(sum(amount_paise),0) from public.referral_payouts where referrer_profile_id=p_referrer_profile_id) then raise exception 'Payout exceeds available earnings'; end if;
  insert into public.referral_payouts(referrer_profile_id,amount_paise,method,payment_reference,note,paid_at,recorded_by,idempotency_key)
  values(p_referrer_profile_id,p_amount_paise,p_method,nullif(trim(p_reference),''),nullif(trim(p_note),''),coalesce(p_paid_at,now()),p_actor_id,p_idempotency_key) returning * into existing;
  insert into public.audit_events(actor_account_id,action,target_type,target_id,details)
  values(p_actor_id,'offline_payout_recorded','referral_payout',existing.id::text,jsonb_build_object('amount_paise',p_amount_paise,'method',p_method));
  return jsonb_build_object('id',existing.id);
end;
$$;

create function private.prevent_history_change() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Financial and audit history is immutable; use corrective records'; end;
$$;
create trigger immutable_receipts before update or delete on public.receipts for each row execute function private.prevent_history_change();
create trigger immutable_earnings before update or delete on public.referral_earnings for each row execute function private.prevent_history_change();
create trigger immutable_payouts before update or delete on public.referral_payouts for each row execute function private.prevent_history_change();
create trigger immutable_attempts before update or delete on public.payment_attempts for each row execute function private.prevent_history_change();
create trigger immutable_audits before update or delete on public.audit_events for each row execute function private.prevent_history_change();
revoke update,delete,truncate on public.receipts,public.referral_earnings,public.referral_payouts,public.payment_attempts,public.audit_events from service_role;
revoke all on all tables in schema private from public,anon,authenticated;
grant execute on function public.consume_rate_limit(text,integer,integer),public.create_account_session(uuid,uuid),public.resolve_account_session(uuid),public.revoke_account_session(uuid),public.change_account_password(uuid,text,text),public.record_offline_payout(uuid,uuid,integer,text,text,text,timestamptz,uuid) to service_role;

-- Updated ownership guards are appended below.

create or replace function public.authenticate_account(p_mobile text,p_password text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.accounts; actual text; roles jsonb;
begin
  select * into a from public.accounts where mobile=trim(p_mobile) and status='active' for update;
  -- Spend the bcrypt work even for unknown/disabled accounts to reduce timing enumeration.
  actual:=extensions.crypt(p_password,coalesce(a.password_hash,extensions.gen_salt('bf',12)));
  if a.id is null or actual is distinct from a.password_hash then return null; end if;
  select coalesce(jsonb_agg(role order by role),'[]'::jsonb) into roles from public.account_roles where account_id=a.id;
  insert into public.audit_events(actor_account_id,action,target_type,target_id) values(a.id,'login','account',a.id::text);
  return jsonb_build_object('id',a.id,'mobile',a.mobile,'displayName',a.display_name,'roles',roles);
end;
$$;
create function public.authenticate_account_session(p_mobile text,p_password text,p_session_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare identity jsonb;
begin
  identity:=public.authenticate_account(p_mobile,p_password);
  if identity is null then return null; end if;
  perform public.create_account_session((identity->>'id')::uuid,p_session_id);
  return identity;
end;
$$;
grant execute on function public.authenticate_account_session(text,text,uuid) to service_role;

create or replace function public.grant_temporary_farmer_edit(p_actor_id uuid,p_employee_id uuid,p_farmer_id uuid,p_allowed_fields text[],p_reason text,p_expires_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_allowed constant text[] := array['name','date_of_birth','village','district','taluka','income_source','cluster_type'];
begin
  if not private.has_role(p_actor_id,array['manager','super_admin']) then raise exception 'Not authorized'; end if;
  if not private.has_role(p_employee_id,array['employee']) then raise exception 'The selected account is not an employee'; end if;
  if p_expires_at<=now() or p_expires_at>now()+interval '7 days' then raise exception 'Grant expiry must be within seven days'; end if;
  if cardinality(p_allowed_fields)=0 or not p_allowed_fields<@v_allowed then raise exception 'Invalid editable fields'; end if;
  if not exists(select 1 from public.farmers where id=p_farmer_id and onboarding_employee_id=p_employee_id) then raise exception 'Not authorized'; end if;
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

create or replace function public.create_staff_account(p_actor_id uuid,p_name text,p_mobile text,p_password text,p_role text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_code text;
begin
  if not private.has_role(p_actor_id,array['super_admin']) then raise exception 'Only a super admin can create staff accounts'; end if;
  if p_role not in ('employee','manager') then raise exception 'Invalid staff role'; end if;
  if trim(p_mobile) !~ '^[0-9]{10}$' or char_length(p_password)<15 or octet_length(p_password)>72 then raise exception 'Valid mobile and password are required'; end if;
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
revoke execute on all functions in schema public from public, anon, authenticated;
commit;
