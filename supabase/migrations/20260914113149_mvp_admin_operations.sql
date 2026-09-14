begin;
alter default privileges revoke execute on functions from public,anon,authenticated;

create or replace function public.get_admin_page(p_actor_id uuid,p_section text default 'registrations',p_query text default '',p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare items jsonb; q text:=trim(p_query); off integer:=(p_page-1)*25; summary jsonb;
begin
 if not private.has_role(p_actor_id,array['manager','super_admin']) then raise exception 'Not authorized'; end if;
 if p_page is null or p_page<1 or p_page>10000 or q is null or length(q)>100 then raise exception 'Invalid data' using errcode='23514'; end if;
 select jsonb_build_object('total',count(*),'completed',count(*) filter(where status='completed'),'pending',count(*) filter(where status<>'completed')) into summary from public.registrations;
 if p_section='registrations' then
   select coalesce(jsonb_agg(x),'[]') into items from (
    select g.id,p.name as label,g.reference,g.status,g.fee_amount_paise as "amountPaise",g.created_at as "createdAt",'******'||right(p.mobile,4) as mobile,f.id as "farmerId",a.display_name as actor
    from public.registrations g join public.persons p on p.id=g.person_id left join public.farmers f on f.registration_id=g.id left join public.accounts a on a.id=g.onboarding_employee_id
    where q='' or p.name ilike q||'%' or p.mobile=q or g.reference ilike q||'%'
    order by g.created_at desc,g.id desc limit 26 offset off) x;
 elsif p_section='staff' then
   select coalesce(jsonb_agg(x),'[]') into items from (
    select a.id,a.display_name as label,a.mobile,a.status,a.created_at as "createdAt",array(select role from public.account_roles where account_id=a.id order by role) as roles,
     (select count(*) from public.farmers where onboarding_employee_id=a.id) as "onboardedFarmers"
    from public.accounts a where exists(select 1 from public.account_roles r where r.account_id=a.id and r.role in ('employee','manager')) and (q='' or a.display_name ilike q||'%' or a.mobile=q)
    order by a.created_at desc,a.id desc limit 26 offset off) x;
 elsif p_section='referrers' then
   select coalesce(jsonb_agg(x),'[]') into items from (
    select rp.id,a.display_name as label,rp.referral_code as reference,a.status,
     coalesce((select sum(amount_paise) from public.referral_earnings where referrer_profile_id=rp.id),0) as "earnedPaise",
     coalesce((select sum(amount_paise) from public.referral_payouts where referrer_profile_id=rp.id),0) as "paidPaise"
    from public.referrer_profiles rp join public.accounts a on a.id=rp.account_id where q='' or a.display_name ilike q||'%' or rp.referral_code ilike upper(q)||'%' or a.mobile=q
    order by a.display_name,rp.id limit 26 offset off) x;
 elsif p_section='payouts' then
   select coalesce(jsonb_agg(x),'[]') into items from (
    select p.id,a.display_name as label,p.payment_reference as reference,p.method as status,p.amount_paise as "amountPaise",p.paid_at as "createdAt",actor.display_name as actor
    from public.referral_payouts p join public.referrer_profiles rp on rp.id=p.referrer_profile_id join public.accounts a on a.id=rp.account_id join public.accounts actor on actor.id=p.recorded_by
    where q='' or a.display_name ilike q||'%' or p.payment_reference ilike q||'%' order by p.paid_at desc,p.id desc limit 26 offset off) x;
 elsif p_section='grants' then
   select coalesce(jsonb_agg(x),'[]') into items from (
    select t.id,p.name as label,g.reference,a.display_name as actor,t.allowed_fields as fields,t.created_at as "createdAt",t.expires_at as "expiresAt",case when t.revoked_at is not null then 'revoked' when t.expires_at<now() then 'expired' else 'active' end as status
    from public.temporary_permission_grants t join public.accounts a on a.id=t.employee_id join public.farmers f on f.id=t.farmer_id join public.persons p on p.id=f.person_id join public.registrations g on g.id=f.registration_id
    where q='' or p.name ilike q||'%' or g.reference ilike q||'%' or a.display_name ilike q||'%' order by t.created_at desc,t.id desc limit 26 offset off) x;
 elsif p_section='audit' then
   select coalesce(jsonb_agg(x),'[]') into items from (
    select e.id::text as id,e.action as label,e.target_type as status,e.target_id as reference,a.display_name as actor,e.created_at as "createdAt"
    from public.audit_events e left join public.accounts a on a.id=e.actor_account_id where q='' or e.action ilike q||'%' order by e.created_at desc,e.id desc limit 26 offset off) x;
 elsif p_section='exceptions' then
   select coalesce(jsonb_agg(x),'[]') into items from (
    select * from (
     select 'event-'||e.id as id,e.event_type as label,e.provider_event_id as reference,e.status,e.received_at as "createdAt",o.registration_id as "registrationId",e.payload->>'paymentId' as "paymentId"
     from public.payment_events e left join public.payment_orders o on o.id=e.payment_order_id
     where e.status='failed' or e.event_type like 'refund.%' or e.event_type like '%dispute%' or e.event_type like '%revers%' or e.event_type like '%chargeback%' or e.event_type like '%correction%'
     union all
     select 'audit-'||e.id,e.action,e.target_id,'review',e.created_at,coalesce(o.registration_id,case when e.target_type='registration' then e.target_id::uuid else null end),pa.provider_payment_id
     from public.audit_events e left join public.payment_attempts pa on e.target_type='payment_attempt' and pa.id::text=e.target_id left join public.payment_orders o on o.id=pa.payment_order_id where e.action in ('additional_capture_requires_review','payment_verification_requires_review')
     union all
     select 'reservation-'||g.id,'Unconfirmed order creation',g.reference,'uncertain',c.created_at,g.id,null from private.checkout_orders c join public.registrations g on g.id=c.registration_id where c.state='creating' and c.created_at<now()-interval '5 minutes'
    ) event where q='' or label ilike q||'%' or reference ilike q||'%' order by "createdAt" desc,id desc limit 26 offset off) x;
 else raise exception 'Invalid section' using errcode='23514'; end if;
 return jsonb_build_object('summary',summary,'rows',case when jsonb_array_length(items)>25 then items-25 else items end,'hasNext',jsonb_array_length(items)>25,'page',p_page);
end; $$;

create or replace function public.get_admin_registration(p_actor_id uuid,p_registration_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.has_role(p_actor_id,array['manager','super_admin']) then raise exception 'Not authorized'; end if;
 select jsonb_build_object('id',g.id,'reference',g.reference,'name',p.name,'mobileMasked','******'||right(p.mobile,4),'status',g.status,'amountPaise',g.fee_amount_paise,'createdAt',g.created_at,'completedAt',g.completed_at,'employee',a.display_name,'referralCode',rp.referral_code,'paymentMode',g.payment_mode,'farmerId',f.id,'membership',m.membership_number,'receiptNumber',r.receipt_number,'receiptToken',r.public_token,
  'orders',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'providerOrderId',o.provider_order_id,'amountPaise',o.amount_paise,'status',o.status,'createdAt',o.created_at,'paidAt',o.paid_at,'payments',coalesce((select jsonb_agg(jsonb_build_object('paymentId',pa.provider_payment_id,'amountPaise',pa.amount_paise,'status',pa.status,'capturedAt',pa.captured_at)) from public.payment_attempts pa where pa.payment_order_id=o.id),'[]'::jsonb))) from public.payment_orders o where o.registration_id=g.id),'[]'::jsonb)) into result
 from public.registrations g join public.persons p on p.id=g.person_id left join public.accounts a on a.id=g.onboarding_employee_id left join public.referrer_profiles rp on rp.id=g.referrer_profile_id left join public.farmers f on f.registration_id=g.id left join public.memberships m on m.registration_id=g.id left join public.receipts r on r.registration_id=g.id where g.id=p_registration_id;
 return result;
end; $$;

create or replace function public.search_admin_options(p_actor_id uuid,p_kind text,p_query text,p_employee_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; q text:=trim(p_query);
begin
 if not private.has_role(p_actor_id,array['manager','super_admin']) then raise exception 'Not authorized'; end if;
 if q is null or length(q)<2 or length(q)>100 then return '[]'::jsonb; end if;
 if p_kind='farmer' then
  select coalesce(jsonb_agg(x),'[]') into result from (select f.id,p.name||' · '||g.reference as label from public.farmers f join public.persons p on p.id=f.person_id join public.registrations g on g.id=f.registration_id where f.onboarding_employee_id=p_employee_id and (p.name ilike q||'%' or p.mobile=q or g.reference ilike q||'%') order by p.name,f.id limit 20) x;
 elsif p_kind='employee' then
  select coalesce(jsonb_agg(x),'[]') into result from (select a.id,a.display_name||' · '||a.mobile as label from public.accounts a where a.status='active' and exists(select 1 from public.account_roles r where r.account_id=a.id and r.role='employee') and (a.display_name ilike q||'%' or a.mobile=q) order by a.display_name,a.id limit 20) x;
 elsif p_kind='referrer' then
  select coalesce(jsonb_agg(x),'[]') into result from (select rp.id,a.display_name||' · '||rp.referral_code as label,coalesce((select sum(amount_paise) from public.referral_earnings where referrer_profile_id=rp.id),0)-coalesce((select sum(amount_paise) from public.referral_payouts where referrer_profile_id=rp.id),0) as "availablePaise" from public.referrer_profiles rp join public.accounts a on a.id=rp.account_id where a.display_name ilike q||'%' or a.mobile=q or rp.referral_code ilike upper(q)||'%' order by a.display_name,rp.id limit 20) x;
 else raise exception 'Invalid kind' using errcode='23514'; end if;
 return result;
end; $$;

create or replace function public.set_staff_status(p_actor_id uuid,p_account_id uuid,p_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.has_role(p_actor_id,array['super_admin']) or p_actor_id=p_account_id then raise exception 'Not authorized'; end if;
 if p_status is null or p_status not in ('active','disabled') then raise exception 'Invalid status' using errcode='23514'; end if;
 perform 1 from public.accounts where id=p_account_id for update;
 if not exists(select 1 from public.account_roles where account_id=p_account_id and role in ('employee','manager')) or exists(select 1 from public.account_roles where account_id=p_account_id and role='super_admin') then raise exception 'Not authorized'; end if;
 update public.accounts set status=p_status,updated_at=now() where id=p_account_id and status<>p_status;
 if found then
  update private.account_sessions set revoked_at=now() where account_id=p_account_id and revoked_at is null;
  insert into public.audit_events(actor_account_id,action,target_type,target_id,details) values(p_actor_id,'staff_status_changed','account',p_account_id::text,jsonb_build_object('status',p_status));
 end if;
 return jsonb_build_object('status',p_status);
end; $$;

create or replace function public.revoke_farmer_grant(p_actor_id uuid,p_grant_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not private.has_role(p_actor_id,array['manager','super_admin']) then raise exception 'Not authorized'; end if;
 update public.temporary_permission_grants set revoked_at=now(),revoked_by=p_actor_id where id=p_grant_id and revoked_at is null;
 if found then insert into public.audit_events(actor_account_id,action,target_type,target_id) values(p_actor_id,'farmer_grant_revoked','permission_grant',p_grant_id::text); end if;
 return true;
end; $$;

revoke execute on function public.get_admin_page(uuid,text,text,integer),public.get_admin_registration(uuid,uuid),public.search_admin_options(uuid,text,text,uuid),public.set_staff_status(uuid,uuid,text),public.revoke_farmer_grant(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_admin_page(uuid,text,text,integer),public.get_admin_registration(uuid,uuid),public.search_admin_options(uuid,text,text,uuid),public.set_staff_status(uuid,uuid,text),public.revoke_farmer_grant(uuid,uuid) to service_role;
create or replace function public.record_payment_event(
  p_event_id text,p_event_type text,p_provider_order_id text,p_provider_payment_id text,
  p_amount_paise integer,p_currency text,p_summary jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.payment_events; oid uuid; result jsonb;
begin
  select id into oid from public.payment_orders where provider_order_id=p_provider_order_id;
  if oid is null then select payment_order_id into oid from public.payment_attempts where provider_payment_id=p_provider_payment_id; end if;
  insert into public.payment_events(provider_event_id,event_type,payment_order_id,signature_verified,status,payload)
  values(p_event_id,p_event_type,oid,true,'received',jsonb_build_object('orderId',p_provider_order_id,'paymentId',p_provider_payment_id,'amountPaise',p_amount_paise,'currency',p_currency))
  on conflict(provider_event_id) do nothing;
  select * into e from public.payment_events where provider_event_id=p_event_id for update;
  if e.event_type<>p_event_type or e.payload<>jsonb_build_object('orderId',p_provider_order_id,'paymentId',p_provider_payment_id,'amountPaise',p_amount_paise,'currency',p_currency) then
    return jsonb_build_object('failed',true);
  end if;
  if e.status in ('processed','ignored') then return jsonb_build_object('duplicate',true); end if;
  if p_event_type not in ('payment.captured','order.paid') then
    update public.payment_events set status='ignored',processed_at=now() where id=e.id;
    if p_event_type like 'refund.%' or p_event_type like '%dispute%' or p_event_type like '%revers%' or p_event_type like '%chargeback%' or p_event_type like '%correction%' then
      insert into public.audit_events(action,target_type,target_id,details)
      values('payment_adjustment_requires_review','payment_event',e.id::text,jsonb_build_object('event_type',p_event_type));
    end if;
    return jsonb_build_object('ignored',true);
  end if;
  begin
    result:=public.finalize_registration_payment(p_provider_order_id,p_provider_payment_id,p_amount_paise,p_currency,'farmer',true);
    update public.payment_events set status='processed',processed_at=now(),payment_order_id=oid,error_message=null where id=e.id;
    return result;
  exception when others then
    -- Do not rethrow: that would roll back the durable failed-event record too.
    update public.payment_events set status='failed',processed_at=now(),error_message=sqlstate where id=e.id;
    return jsonb_build_object('failed',true);
  end;
end;
$$;
commit;
