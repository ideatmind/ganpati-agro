begin;
-- Pending profiles may be erased while their checkout/cash evidence remains.
alter table public.registrations drop constraint registrations_erasure_check;
alter table public.registrations add constraint registrations_erasure_check check (
 (erased_at is null and person_id is not null) or (erased_at is not null and person_id is null)
);

create or replace function public.purge_admin_registrations(p_actor_id uuid,p_ids uuid[],p_password text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item uuid; g public.registrations; person uuid; account uuid; saved_hash text; changed integer:=0;
begin
 if not private.has_role(p_actor_id,array['super_admin']) then raise exception 'Not authorized'; end if;
 if p_ids is null or cardinality(p_ids) not between 1 and 100 or array_position(p_ids,null) is not null then raise exception 'Invalid data' using errcode='23514'; end if;
 if p_password is null or length(p_password)=0 then raise exception 'Password confirmation required'; end if;
 if octet_length(p_password)>72 then raise exception 'Incorrect confirmation password'; end if;
 select password_hash into saved_hash from public.accounts where id=p_actor_id and status='active' for share;
 if saved_hash is null or extensions.crypt(p_password,saved_hash)<>saved_hash then raise exception 'Incorrect confirmation password'; end if;

 -- Same registration locks as checkout, capture and restore. Failure rolls back
 -- the entire selection. Existing audit events make response-loss retries safe.
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
  if account=p_actor_id or exists(select 1 from public.account_roles where account_id=account and role<>'farmer_referrer') then
   raise exception 'Staff accounts cannot be permanently deleted';
  end if;
  update public.referrer_profiles set active=false where account_id=account;
  delete from private.account_sessions where account_id=account;
  delete from public.account_roles where account_id=account;
  update public.accounts set mobile=null,display_name='Deleted farmer',password_hash='!erased',status='disabled',erased_at=now(),updated_at=now() where id=account;
  update public.temporary_permission_grants set revoked_at=coalesce(revoked_at,now()),revoked_by=coalesce(revoked_by,p_actor_id)
   where farmer_id in(select id from public.farmers where registration_id=item);
  delete from public.farmer_plots where farmer_id in(select id from public.farmers where registration_id=item);
  delete from public.registration_plots where registration_id=item;
  delete from private.person_identifiers where person_id=person;
  delete from private.registration_archives where registration_id=item;
  if g.status='completed'
    or exists(select 1 from private.checkout_orders where registration_id=item)
    or exists(select 1 from public.payment_orders where registration_id=item)
    or exists(select 1 from public.cash_collections where registration_id=item) then
   update public.farmers set person_id=null,erased_at=now(),updated_at=now() where registration_id=item;
   update public.registrations set person_id=null,erased_at=now() where id=item;
  else
   delete from public.registrations where id=item;
  end if;
  delete from public.persons where id=person;
  insert into public.audit_events(actor_account_id,action,target_type,target_id,details)
   values(p_actor_id,'registration_permanently_deleted','registration',item::text,jsonb_build_object('financialHistoryRetained',true));
  changed:=changed+1;
 end loop;
 return jsonb_build_object('changed',changed);
end; $$;

create or replace function public.get_checkout(p_registration_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',g.id,'reference',g.reference,'amountPaise',g.fee_amount_paise,'status',g.status,'erasedAt',g.erased_at,
    'providerOrderId',(select provider_order_id from public.payment_orders where registration_id=g.id order by created_at desc limit 1),
    'receiptToken',(select public_token from public.receipts where registration_id=g.id))
  from public.registrations g where g.id=p_registration_id;
$$;

create or replace function public.prepare_payment_order(p_registration_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.registrations; o public.payment_orders; k uuid; n integer;
begin
  select * into g from public.registrations where id=p_registration_id for update;
  if not found then raise exception 'Registration not found'; end if;
  if g.erased_at is not null then raise exception 'Registration was permanently deleted'; end if;
  if g.status='completed' then return public.get_checkout(g.id); end if;
  select count(*) into n from public.payment_orders where registration_id=g.id;
  if n>1 then return jsonb_build_object('pending',true); end if;
  select * into o from public.payment_orders where registration_id=g.id;
  if found then return jsonb_build_object('providerOrderId',o.provider_order_id,'amountPaise',o.amount_paise,'currency',o.currency); end if;
  insert into private.checkout_orders(registration_id,state) values(g.id,'creating')
    on conflict(registration_id) do nothing returning request_key into k;
  if k is null then return jsonb_build_object('pending',true); end if;
  update public.registrations set referral_locked_at=coalesce(referral_locked_at,now()) where id=g.id;
  return jsonb_build_object('requestKey',k,'amountPaise',g.fee_amount_paise,'reference',g.reference);
end;
$$;

create or replace function public.record_payment_order(p_registration_id uuid,p_provider_order_id text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.registrations; o public.payment_orders;
begin
  select * into g from public.registrations where id=p_registration_id for update;
  if not found then raise exception 'Registration not found'; end if;
  if not exists(select 1 from private.checkout_orders where registration_id=g.id and request_key=p_idempotency_key) then raise exception 'Invalid checkout request'; end if;
  select * into o from public.payment_orders where registration_id=g.id order by created_at limit 1;
  if found then
    if o.provider_order_id<>p_provider_order_id then raise exception 'Checkout already has a payment order'; end if;
  else
    insert into public.payment_orders(registration_id,provider_order_id,idempotency_key,amount_paise,currency)
    values(g.id,p_provider_order_id,p_idempotency_key,g.fee_amount_paise,'INR') returning * into o;
  end if;
  update private.checkout_orders set state='ready' where registration_id=g.id;
  return jsonb_build_object('providerOrderId',o.provider_order_id,'amountPaise',o.amount_paise,'currency',o.currency,'erasedAt',g.erased_at);
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
-- Erased cash profiles no longer appear as actionable employee checkouts.
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
    'cashPending',(select count(*) from public.cash_collections c join public.registrations g on g.id=c.registration_id where c.employee_id=p_account_id and g.erased_at is null and g.status<>'completed'),
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

revoke all on function public.purge_admin_registrations(uuid,uuid[],text),public.get_checkout(uuid),public.prepare_payment_order(uuid),public.record_payment_order(uuid,text,uuid),public.finalize_registration_payment(text,text,integer,text,text,boolean) from public,anon,authenticated;
grant execute on function public.purge_admin_registrations(uuid,uuid[],text),public.get_checkout(uuid),public.prepare_payment_order(uuid),public.record_payment_order(uuid,text,uuid),public.finalize_registration_payment(text,text,integer,text,text,boolean) to service_role;
commit;
