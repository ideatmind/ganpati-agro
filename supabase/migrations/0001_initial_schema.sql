begin;

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  mobile varchar(10) not null unique check (mobile ~ '^[0-9]{10}$'),
  password_hash text not null,
  display_name text not null check (char_length(display_name) between 1 and 200),
  status text not null default 'pending_payment' check (status in ('pending_payment','active','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.account_roles (
  account_id uuid not null references public.accounts(id) on delete cascade,
  role text not null check (role in ('farmer_referrer','employee','manager','super_admin')),
  granted_at timestamptz not null default now(),
  primary key (account_id, role)
);

create table public.persons (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.accounts(id),
  name text not null check (char_length(name) between 1 and 200),
  mobile varchar(10) not null unique check (mobile ~ '^[0-9]{10}$'),
  date_of_birth date not null check (date_of_birth <= current_date),
  village text not null check (char_length(village) between 1 and 200),
  taluka text not null,
  district text not null,
  income_source text not null check (income_source in ('agriculture','business','job','other')),
  cluster_type text not null check (cluster_type in ('pulses','cereals','cash','fruits','vegs','allied')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.person_identifiers (
  person_id uuid primary key references public.persons(id) on delete restrict,
  aadhar_fingerprint char(64) not null unique check (aadhar_fingerprint ~ '^[0-9a-f]{64}$'),
  aadhar_ciphertext text not null,
  aadhar_last_four char(4) not null check (aadhar_last_four ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now()
);

create table public.districts (
  code text primary key,
  name_en text not null,
  name_mr text not null,
  active boolean not null default true
);

create table public.talukas (
  code text primary key,
  district_code text not null references public.districts(code),
  name_en text not null,
  name_mr text not null,
  active boolean not null default true,
  unique (district_code, code)
);
create index talukas_district_code_idx on public.talukas(district_code);

create table public.referrer_profiles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.accounts(id),
  referral_code text not null unique check (referral_code ~ '^[A-Z0-9]{6,16}$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.fee_versions (
  id uuid primary key default gen_random_uuid(),
  amount_paise integer not null check (amount_paise > 0),
  currency char(3) not null default 'INR' check (currency = 'INR'),
  effective_from timestamptz not null,
  effective_to timestamptz,
  created_by uuid references public.accounts(id),
  check (effective_to is null or effective_to > effective_from)
);

create table public.commission_rate_versions (
  id uuid primary key default gen_random_uuid(),
  basis_points integer not null check (basis_points between 0 and 10000),
  effective_from timestamptz not null,
  effective_to timestamptz,
  created_by uuid references public.accounts(id),
  check (effective_to is null or effective_to > effective_from)
);

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  person_id uuid not null unique references public.persons(id),
  fee_version_id uuid not null references public.fee_versions(id),
  fee_amount_paise integer not null check (fee_amount_paise > 0),
  commission_rate_id uuid not null references public.commission_rate_versions(id),
  commission_basis_points integer not null check (commission_basis_points between 0 and 10000),
  status text not null default 'payment_pending' check (status in ('payment_pending','processing','completed','payment_exception')),
  channel text not null check (channel in ('public','employee_assisted')),
  payment_mode text not null check (payment_mode in ('farmer_online','employee_cash_assisted')),
  onboarding_employee_id uuid references public.accounts(id),
  referrer_profile_id uuid references public.referrer_profiles(id),
  referral_locked_at timestamptz,
  consent_given boolean not null check (consent_given),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((channel = 'employee_assisted') = (onboarding_employee_id is not null)),
  check (payment_mode <> 'employee_cash_assisted' or channel = 'employee_assisted')
);
create index registrations_employee_created_idx on public.registrations(onboarding_employee_id, created_at desc);
create index registrations_referrer_created_idx on public.registrations(referrer_profile_id, created_at desc);
create index registrations_status_created_idx on public.registrations(status, created_at desc);

create table public.registration_plots (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete restrict,
  plot_no text not null check (char_length(plot_no) between 1 and 100),
  area_acres numeric(10,2) not null check (area_acres > 0),
  crop_name text not null check (char_length(crop_name) between 1 and 100),
  irrigation_source text not null check (irrigation_source in ('well','borewell','canal','drip','sprinkler','rainfed','river','other')),
  created_at timestamptz not null default now()
);
create index registration_plots_registration_idx on public.registration_plots(registration_id);

create table public.cash_collections (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references public.registrations(id) on delete restrict,
  employee_id uuid not null references public.accounts(id),
  amount_paise integer not null check (amount_paise > 0),
  received_at timestamptz not null default now(),
  note text,
  corrected_at timestamptz,
  corrected_by uuid references public.accounts(id),
  correction_reason text
);
create index cash_collections_employee_received_idx on public.cash_collections(employee_id, received_at desc);

create table public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete restrict,
  provider text not null default 'razorpay' check (provider = 'razorpay'),
  provider_order_id text not null unique,
  idempotency_key uuid not null unique,
  amount_paise integer not null check (amount_paise > 0),
  currency char(3) not null check (currency = 'INR'),
  status text not null default 'created' check (status in ('created','attempted','paid','failed','expired')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index payment_orders_registration_created_idx on public.payment_orders(registration_id, created_at desc);

create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  payment_order_id uuid not null references public.payment_orders(id) on delete restrict,
  provider_payment_id text not null unique,
  amount_paise integer not null check (amount_paise > 0),
  currency char(3) not null check (currency = 'INR'),
  status text not null check (status in ('authorized','captured','failed','reversed','disputed')),
  payer_kind text not null check (payer_kind in ('farmer','employee')),
  signature_verified boolean not null default false,
  captured_at timestamptz,
  created_at timestamptz not null default now()
);
create index payment_attempts_order_idx on public.payment_attempts(payment_order_id);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  event_type text not null,
  payment_order_id uuid references public.payment_orders(id),
  signature_verified boolean not null,
  status text not null check (status in ('received','processed','ignored','failed')),
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text
);
create index payment_events_order_idx on public.payment_events(payment_order_id);

create table public.farmers (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null unique references public.persons(id),
  registration_id uuid not null unique references public.registrations(id),
  onboarding_employee_id uuid references public.accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index farmers_employee_created_idx on public.farmers(onboarding_employee_id, created_at desc);

create table public.farmer_plots (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmers(id) on delete restrict,
  source_registration_plot_id uuid not null unique references public.registration_plots(id),
  plot_no text not null,
  area_acres numeric(10,2) not null check (area_acres > 0),
  crop_name text not null,
  irrigation_source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index farmer_plots_farmer_idx on public.farmer_plots(farmer_id);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  membership_number text not null unique,
  farmer_id uuid not null unique references public.farmers(id),
  registration_id uuid not null unique references public.registrations(id),
  status text not null default 'active' check (status in ('active','suspended','cancelled')),
  activated_at timestamptz not null default now()
);

create table public.referral_earnings (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references public.registrations(id) on delete restrict,
  referrer_profile_id uuid not null references public.referrer_profiles(id),
  fee_amount_paise integer not null check (fee_amount_paise > 0),
  basis_points integer not null check (basis_points between 0 and 10000),
  amount_paise integer not null check (amount_paise >= 0),
  status text not null default 'credited' check (status in ('credited','adjusted')),
  credited_at timestamptz not null default now()
);
create index referral_earnings_referrer_date_idx on public.referral_earnings(referrer_profile_id, credited_at desc);

create table public.referral_payouts (
  id uuid primary key default gen_random_uuid(),
  referrer_profile_id uuid not null references public.referrer_profiles(id),
  amount_paise integer not null check (amount_paise > 0),
  method text not null check (method in ('cash','upi','bank_transfer','other')),
  payment_reference text,
  note text,
  paid_at timestamptz not null,
  recorded_by uuid not null references public.accounts(id),
  created_at timestamptz not null default now()
);
create index referral_payouts_referrer_date_idx on public.referral_payouts(referrer_profile_id, paid_at desc);

create table public.payout_allocations (
  payout_id uuid not null references public.referral_payouts(id) on delete restrict,
  earning_id uuid not null references public.referral_earnings(id) on delete restrict,
  amount_paise integer not null check (amount_paise > 0),
  primary key (payout_id, earning_id)
);
create index payout_allocations_earning_idx on public.payout_allocations(earning_id);

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  public_token uuid not null unique default gen_random_uuid(),
  registration_id uuid not null unique references public.registrations(id),
  payment_attempt_id uuid not null unique references public.payment_attempts(id),
  membership_id uuid not null unique references public.memberships(id),
  amount_paise integer not null check (amount_paise > 0),
  currency char(3) not null default 'INR',
  member_name text not null,
  member_mobile_masked text not null,
  issued_at timestamptz not null default now()
);

create table public.temporary_permission_grants (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.accounts(id),
  farmer_id uuid not null references public.farmers(id),
  allowed_fields text[] not null check (cardinality(allowed_fields) > 0),
  reason text not null check (char_length(reason) between 3 and 500),
  granted_by uuid not null references public.accounts(id),
  expires_at timestamptz not null check (expires_at > created_at),
  revoked_at timestamptz,
  revoked_by uuid references public.accounts(id),
  created_at timestamptz not null default now()
);
create index permission_grants_lookup_idx on public.temporary_permission_grants(employee_id, farmer_id, expires_at desc);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_account_id uuid references public.accounts(id),
  action text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_actor_date_idx on public.audit_events(actor_account_id, created_at desc);
create index audit_events_action_date_idx on public.audit_events(action, created_at desc);

create sequence public.registration_reference_seq;
create sequence public.membership_number_seq;
create sequence public.receipt_number_seq;

insert into public.fee_versions(amount_paise, effective_from) values (50000, now());
insert into public.commission_rate_versions(basis_points, effective_from) values (1000, now());

create or replace function private.has_role(p_account_id uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.account_roles where account_id = p_account_id and role = any(p_roles));
$$;

create or replace function public.authenticate_account(p_mobile text, p_password text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_account public.accounts; v_roles jsonb;
begin
  select * into v_account from public.accounts
  where mobile = trim(p_mobile) and status = 'active' and password_hash = extensions.crypt(p_password, password_hash);
  if not found then return null; end if;
  select coalesce(jsonb_agg(role order by role), '[]'::jsonb) into v_roles
  from public.account_roles where account_id = v_account.id;
  insert into public.audit_events(actor_account_id, action, target_type, target_id)
  values(v_account.id, 'login', 'account', v_account.id::text);
  return jsonb_build_object('id',v_account.id,'mobile',v_account.mobile,'displayName',v_account.display_name,'roles',v_roles);
end;
$$;

create or replace function public.get_account_session(p_account_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id',a.id,'mobile',a.mobile,'displayName',a.display_name,
    'roles',coalesce((select jsonb_agg(ar.role order by ar.role) from public.account_roles ar where ar.account_id=a.id),'[]'::jsonb))
  from public.accounts a where a.id=p_account_id and a.status='active';
$$;

create or replace function public.create_registration(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_account_id uuid; v_person_id uuid; v_registration_id uuid; v_referrer_id uuid;
  v_fee public.fee_versions; v_rate public.commission_rate_versions; v_plot jsonb;
  v_employee_id uuid; v_reference text; v_ref_code text;
begin
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
$$;

create or replace function public.record_payment_order(p_registration_id uuid,p_provider_order_id text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_reg public.registrations; v_order public.payment_orders;
begin
  select * into v_reg from public.registrations where id=p_registration_id for update;
  if not found then raise exception 'Registration not found'; end if;
  if v_reg.status='completed' then raise exception 'Registration is already completed'; end if;
  update public.registrations set referral_locked_at=coalesce(referral_locked_at,now()) where id=p_registration_id;
  insert into public.payment_orders(registration_id,provider_order_id,idempotency_key,amount_paise,currency)
  values(p_registration_id,p_provider_order_id,p_idempotency_key,v_reg.fee_amount_paise,'INR') returning * into v_order;
  return jsonb_build_object('id',v_order.id,'providerOrderId',v_order.provider_order_id,'amountPaise',v_order.amount_paise,'currency',v_order.currency);
end;
$$;

create or replace function public.finalize_registration_payment(
  p_provider_order_id text,p_provider_payment_id text,p_amount_paise integer,p_currency text,p_payer_kind text,p_signature_verified boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_order public.payment_orders; v_reg public.registrations; v_person public.persons;
  v_attempt_id uuid; v_farmer_id uuid; v_membership_id uuid; v_receipt_token uuid;
  v_membership_number text; v_receipt_number text;
begin
  if not p_signature_verified then raise exception 'Payment signature is not verified'; end if;
  select * into v_order from public.payment_orders where provider_order_id=p_provider_order_id for update;
  if not found then raise exception 'Payment order not found'; end if;
  if v_order.amount_paise<>p_amount_paise or v_order.currency<>p_currency then raise exception 'Payment amount or currency does not match'; end if;
  select * into v_reg from public.registrations where id=v_order.registration_id for update;
  if v_reg.status='completed' then
    return (select jsonb_build_object('registrationId',v_reg.id,'reference',v_reg.reference,'membershipNumber',m.membership_number,'receiptToken',r.public_token,'alreadyCompleted',true)
      from public.memberships m join public.receipts r on r.membership_id=m.id where m.registration_id=v_reg.id);
  end if;
  select * into v_person from public.persons where id=v_reg.person_id;
  insert into public.payment_attempts(payment_order_id,provider_payment_id,amount_paise,currency,status,payer_kind,signature_verified,captured_at)
  values(v_order.id,p_provider_payment_id,p_amount_paise,p_currency,'captured',case when v_reg.payment_mode='employee_cash_assisted' then 'employee' else 'farmer' end,true,now())
  on conflict(provider_payment_id) do update set status='captured',signature_verified=true,captured_at=coalesce(public.payment_attempts.captured_at,now())
  returning id into v_attempt_id;
  update public.payment_orders set status='paid',paid_at=coalesce(paid_at,now()) where id=v_order.id;
  update public.registrations set status='processing' where id=v_reg.id;
  insert into public.farmers(person_id,registration_id,onboarding_employee_id)
  values(v_reg.person_id,v_reg.id,v_reg.onboarding_employee_id) returning id into v_farmer_id;
  insert into public.farmer_plots(farmer_id,source_registration_plot_id,plot_no,area_acres,crop_name,irrigation_source)
  select v_farmer_id,id,plot_no,area_acres,crop_name,irrigation_source from public.registration_plots where registration_id=v_reg.id;
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

create or replace function public.record_payment_event(
  p_event_id text,p_event_type text,p_provider_order_id text,p_provider_payment_id text,
  p_amount_paise integer,p_currency text,p_summary jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order_id uuid; v_result jsonb;
begin
  select id into v_order_id from public.payment_orders where provider_order_id=p_provider_order_id;
  insert into public.payment_events(provider_event_id,event_type,payment_order_id,signature_verified,status,payload)
  values(p_event_id,p_event_type,v_order_id,true,'received',p_summary)
  on conflict(provider_event_id) do nothing;
  if not found then return jsonb_build_object('duplicate',true); end if;
  begin
    v_result := public.finalize_registration_payment(p_provider_order_id,p_provider_payment_id,p_amount_paise,p_currency,'farmer',true);
    update public.payment_events set status='processed',processed_at=now() where provider_event_id=p_event_id;
    return v_result;
  exception when others then
    update public.payment_events set status='failed',processed_at=now(),error_message=left(sqlerrm,500) where provider_event_id=p_event_id;
    raise;
  end;
end;
$$;

create or replace function public.get_receipt(p_public_token uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('receiptNumber',r.receipt_number,'registrationReference',g.reference,'membershipNumber',m.membership_number,
    'memberName',r.member_name,'memberMobile',r.member_mobile_masked,'amountPaise',r.amount_paise,'currency',r.currency,
    'paymentId',pa.provider_payment_id,'issuedAt',r.issued_at)
  from public.receipts r join public.registrations g on g.id=r.registration_id
  join public.memberships m on m.id=r.membership_id join public.payment_attempts pa on pa.id=r.payment_attempt_id
  where r.public_token=p_public_token;
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

alter table public.accounts enable row level security;
alter table public.account_roles enable row level security;
alter table public.persons enable row level security;
alter table public.districts enable row level security;
alter table public.talukas enable row level security;
alter table public.referrer_profiles enable row level security;
alter table public.fee_versions enable row level security;
alter table public.commission_rate_versions enable row level security;
alter table public.registrations enable row level security;
alter table public.registration_plots enable row level security;
alter table public.cash_collections enable row level security;
alter table public.payment_orders enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.payment_events enable row level security;
alter table public.farmers enable row level security;
alter table public.farmer_plots enable row level security;
alter table public.memberships enable row level security;
alter table public.referral_earnings enable row level security;
alter table public.referral_payouts enable row level security;
alter table public.payout_allocations enable row level security;
alter table public.receipts enable row level security;
alter table public.temporary_permission_grants enable row level security;
alter table public.audit_events enable row level security;

revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on function public.authenticate_account(text,text), public.get_account_session(uuid), public.create_registration(jsonb),
  public.record_payment_order(uuid,text,uuid), public.finalize_registration_payment(text,text,integer,text,text,boolean),
  public.get_receipt(uuid), public.get_dashboard(uuid), public.record_payment_event(text,text,text,text,integer,text,jsonb) to service_role;

commit;
