-- Run only against an isolated test database. Everything in this file rolls back.
begin;
do $$
declare
  manager uuid:=gen_random_uuid(); employee uuid:=gen_random_uuid(); other_employee uuid:=gen_random_uuid();
  profile uuid; body jsonb; registration jsonb; retry jsonb; reservation jsonb; result jsonb;
  reg_id uuid; second_id uuid; farmer uuid; session_id uuid:=gen_random_uuid(); key uuid:=gen_random_uuid(); payout jsonb;
  n integer; denied boolean;
begin
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef
    and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute'))) then raise exception 'Public RPC execution regression'; end if;
  if has_schema_privilege('anon','private','usage') then raise exception 'Private schema exposed'; end if;

  insert into public.accounts(id,mobile,password_hash,display_name,status) values
    (manager,'8000000001',extensions.crypt('a long test password',extensions.gen_salt('bf',4)),'Audit manager','active'),
    (employee,'8000000002',extensions.crypt('a long test password',extensions.gen_salt('bf',4)),'Audit employee','active'),
    (other_employee,'8000000003',extensions.crypt('a long test password',extensions.gen_salt('bf',4)),'Other employee','active');
  insert into public.account_roles values(manager,'super_admin',now()),(employee,'employee',now()),(other_employee,'employee',now());
  insert into public.referrer_profiles(account_id,referral_code) values(employee,'AUDITEMP1') returning id into profile;
  body:=jsonb_build_object('name','Audit Farmer','mobile','8000000004','password','a long test password','date_of_birth','1990-01-01',
    'village','Test village','district','dharashiv','taluka','dharashiv','income_source','agriculture','cluster_type','pulses',
    'aadhar_fingerprint',repeat('a',64),'aadhar_ciphertext','synthetic-test-only','aadhar_last_four','0000',
    'onboarding_employee_id',employee,'cash_received',true,'consent',true,
    'plots',jsonb_build_array(jsonb_build_object('plot_no','TEST-1','area_acres',1,'crop_name','Test crop','irrigation_source','well')));
  registration:=public.create_registration(body); reg_id:=(registration->>'id')::uuid;
  retry:=public.create_registration(body); assert registration=retry,'Registration retry duplicated records';
  assert not exists(select 1 from public.farmers where registration_id=reg_id),'Farmer created before capture';
  assert not exists(select 1 from public.memberships where registration_id=reg_id),'Membership created before capture';
  denied:=false;
  begin perform public.create_registration(body||jsonb_build_object('password','incorrect password')); exception when others then denied:=true; end;
  assert denied,'Wrong credentials resumed registration';
  reservation:=public.prepare_payment_order(reg_id);
  assert reservation?'requestKey','First request did not reserve order';
  result:=public.prepare_payment_order(reg_id); assert result->>'pending'='true','Concurrent order creation was allowed';
  perform public.record_payment_order(reg_id,'order_audit1',(reservation->>'requestKey')::uuid);
  result:=public.prepare_payment_order(reg_id); assert result->>'providerOrderId'='order_audit1','Retry did not reuse order';
  perform public.record_payment_order(reg_id,'order_audit1',(reservation->>'requestKey')::uuid);
  assert (select count(*) from public.payment_orders where registration_id=reg_id)=1,'Duplicate order binding';
  denied:=false;
  begin perform public.finalize_registration_payment('order_audit1','pay_audit1',50000,'INR','employee',null);exception when others then denied:=true;end;
  assert denied,'NULL signature verification accepted';
  denied:=false;
  begin perform public.finalize_registration_payment('order_audit1','pay_audit1',1,'INR','employee',true);exception when others then denied:=true;end;
  assert denied,'Incorrect amount accepted';
  result:=public.record_payment_event('evt_audit1','payment.captured','order_audit1','pay_audit1',50000,'INR','{}');
  assert result?'receiptToken','Webhook did not finalize payment';
  retry:=public.finalize_registration_payment('order_audit1','pay_audit1',50000,'INR','farmer',true);
  assert retry->>'receiptToken'=result->>'receiptToken','Browser/webhook deduplication failed';
  perform public.record_payment_event('evt_audit1','payment.captured','order_audit1','pay_audit1',50000,'INR','{}');
  perform public.record_payment_event('evt_audit2','order.paid','order_audit1','pay_audit1',50000,'INR','{}');
  assert (select count(*) from public.farmers where registration_id=reg_id)=1,'Duplicate farmer';
  assert (select count(*) from public.memberships where registration_id=reg_id)=1,'Duplicate membership';
  assert (select count(*) from public.receipts where registration_id=reg_id)=1,'Duplicate receipt';
  assert (select count(*) from public.referral_earnings where registration_id=reg_id)=1,'Duplicate earning';
  assert (select amount_paise from public.referral_earnings where registration_id=reg_id)=5000,'Incorrect commission';
  assert (select payer_kind from public.payment_attempts where provider_payment_id='pay_audit1')='employee','Untrusted payer kind overrode cash attribution';
  assert not (public.get_receipt((result->>'receiptToken')::uuid)::text like '%aadhar%'),'Receipt exposed identity';

  result:=public.finalize_registration_payment('order_audit1','pay_extra',50000,'INR','farmer',true);
  assert result->>'paymentException'='true','Additional captured payment silently dropped';
  perform public.finalize_registration_payment('order_audit1','pay_extra',50000,'INR','farmer',true);
  assert (select count(*) from public.payment_attempts where provider_payment_id='pay_extra')=1,'Duplicate additional capture';
  assert (select count(*) from public.audit_events where action='additional_capture_requires_review')=1,'Duplicate exception audit';

  body:=body||jsonb_build_object('mobile','8000000005','aadhar_fingerprint',repeat('b',64),'cash_received',false);
  registration:=public.create_registration(body); second_id:=(registration->>'id')::uuid;
  result:=public.record_payment_event('evt_early','payment.captured','order_early','pay_early',50000,'INR','{}');
  assert result->>'failed'='true','Early webhook should be retryable';
  assert exists(select 1 from public.payment_events where provider_event_id='evt_early' and status='failed'),'Failed webhook record rolled back';
  reservation:=public.prepare_payment_order(second_id);
  perform public.record_payment_order(second_id,'order_early',(reservation->>'requestKey')::uuid);
  result:=public.record_payment_event('evt_early','payment.captured','order_early','pay_early',50000,'INR','{}');
  assert result?'receiptToken','Failed webhook retry did not recover';
  result:=public.record_payment_event('evt_failed_late','payment.failed','order_early','pay_early',50000,'INR','{}');
  assert (select status from public.registrations where id=second_id)='completed','Out-of-order failure downgraded completed registration';
  result:=public.record_payment_event('evt_early','payment.captured','order_early','pay_changed',50000,'INR','{}');
  assert result->>'failed'='true','Event ID accepted with different payment';

  payout:=public.record_offline_payout(manager,profile,100,'cash','audit-ref','test',now(),key);
  retry:=public.record_offline_payout(manager,profile,100,'cash','audit-ref','test',now(),key);
  assert payout->>'id'=retry->>'id','Payout retry deducted twice';
  denied:=false;
  begin perform public.record_offline_payout(manager,profile,101,'cash','audit-ref','test',now(),key);exception when others then denied:=true;end;
  assert denied,'Payout key reuse with changed amount accepted';
  denied:=false;
  begin perform public.record_offline_payout(manager,profile,100000,'cash','','',now(),gen_random_uuid());exception when others then denied:=true;end;
  assert denied,'Payout exceeded balance';
  denied:=false;
  begin update public.referral_payouts set amount_paise=1 where id=(payout->>'id')::uuid;exception when others then denied:=true;end;
  assert denied,'Financial history mutable';
  select id into farmer from public.farmers where registration_id=reg_id;
  denied:=false;
  begin perform public.get_farmer_detail(other_employee,farmer);exception when others then denied:=true;end;
  assert denied,'Employee read unrelated farmer';
  denied:=false;
  begin perform public.grant_temporary_farmer_edit(manager,other_employee,farmer,array['name'],'Test access',now()+interval '1 hour');exception when others then denied:=true;end;
  assert denied,'Grant bypassed onboarding ownership';
  perform public.grant_temporary_farmer_edit(manager,employee,farmer,array['name'],'Test access',now()+interval '1 hour');
  perform public.update_farmer_profile(employee,farmer,'{"name":"Updated test name"}');
  denied:=false;
  begin perform public.update_farmer_profile(employee,farmer,'{"village":"Unauthorized village"}');exception when others then denied:=true;end;
  assert denied,'Grant exceeded field scope';
  perform public.revoke_farmer_grant(manager,(select id from public.temporary_permission_grants where farmer_id=farmer limit 1));
  denied:=false;
  begin perform public.update_farmer_profile(employee,farmer,'{"name":"Invalid update"}');exception when others then denied:=true;end;
  assert denied,'Revoked grant remained usable';
  denied:=false;
  begin perform public.update_farmer_profile(manager,farmer,'{"district":"solapur","taluka":"dharashiv"}');exception when others then denied:=true;end;
  assert denied,'Mismatched geography accepted';

  perform public.create_account_session(manager,session_id);
  assert public.resolve_account_session(session_id) is not null,'Session not valid';
  perform public.revoke_account_session(session_id);
  assert public.resolve_account_session(session_id) is null,'Logout did not revoke session';
  session_id:=gen_random_uuid();perform public.create_account_session(manager,session_id);
  perform public.change_account_password(manager,'a long test password','a new long test password');
  assert public.resolve_account_session(session_id) is null,'Password change did not revoke sessions';
  session_id:=gen_random_uuid();perform public.create_account_session(employee,session_id);
  perform public.set_staff_status(manager,employee,'disabled');
  assert public.resolve_account_session(session_id) is null,'Staff deactivation did not revoke session';
  assert not private.has_role(employee,array['employee']),'Disabled staff remained authorized';
  denied:=false;begin perform public.set_staff_status(other_employee,manager,'disabled');exception when others then denied:=true;end;
  assert denied,'Employee could disable admin';
  denied:=false;begin perform public.get_admin_page(other_employee,'registrations','',1);exception when others then denied:=true;end;
  assert denied,'Employee accessed admin list';
  assert (public.get_admin_registration(manager,reg_id)->>'id')::uuid=reg_id,'Admin registration detail missing';
  assert public.get_admin_registration(manager,reg_id)::text not like '%synthetic-test-only%','Admin detail exposed identity ciphertext';
  for body in select to_jsonb(x) from unnest(array['registrations','staff','referrers','payouts','exceptions','grants','audit']) x loop
    result:=public.get_admin_page(manager,body#>>'{}','',1);
    assert jsonb_array_length(result->'rows')<=25,'Admin page is unbounded';
  end loop;
  perform public.record_payment_event('audit-refund','refund.processed',null,'pay_audit1',50000,'INR','{}');
  assert exists(select 1 from public.audit_events where action='payment_adjustment_requires_review'),'Provider exception was not recorded';
  assert (select payment_order_id is not null from public.payment_events where provider_event_id='audit-refund'),'Refund notification not linked to original order';
  assert (select count(*) from public.memberships where registration_id=reg_id)=1,'Provider adjustment changed entitlements';
  for n in 1..5 loop
    result:=public.authenticate_limited_session('8000000001','incorrect long password',gen_random_uuid(),repeat('d',64),repeat('e',64));
    assert result is null,'Invalid password authenticated';
  end loop;
  result:=public.authenticate_limited_session('8000000001','incorrect long password',gen_random_uuid(),repeat('d',64),repeat('e',64));
  assert result->>'rateLimited'='true','Combined login bypassed account throttle';
  for n in 1..20 loop result:=public.get_limited_checkout(reg_id,repeat('f',64),20);end loop;
  assert public.get_limited_checkout(reg_id,repeat('f',64),20)->>'rateLimited'='true','Combined checkout bypassed throttle';
  for n in 1..5 loop assert public.consume_rate_limit(repeat('c',64),5,60),'Rate limit rejected early';end loop;
  assert not public.consume_rate_limit(repeat('c',64),5,60),'Rate limit did not block';
end;
$$;
rollback;
