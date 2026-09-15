begin;
do $$
declare sa uuid:=gen_random_uuid(); employee uuid:=gen_random_uuid(); body jsonb; r uuid; pending_ids uuid[]:='{}';
 item integer; reserved jsonb; result jsonb; denied boolean; snapshot jsonb; account uuid;
begin
 insert into public.accounts(id,mobile,password_hash,display_name,status) values
 (sa,'8300000001',extensions.crypt('test-password',extensions.gen_salt('bf',4)),'Pending purge super','active'),
 (employee,'8300000002',extensions.crypt('test-password',extensions.gen_salt('bf',4)),'Pending purge employee','active');
 insert into public.account_roles(account_id,role) values(sa,'super_admin'),(employee,'employee');
 body:=jsonb_build_object('name','Pending Farmer','password','test-password','date_of_birth','1990-01-01','village','Test village','district','dharashiv','taluka','dharashiv','income_source','agriculture','cluster_type','pulses','aadhar_ciphertext','encrypted-test','aadhar_last_four','0000','consent',true,'plots',jsonb_build_array(jsonb_build_object('plot_no','PENDING-1','area_acres',1,'crop_name','Pulses','irrigation_source','well')));
 -- Reserved, ordered, cash-only and payment-exception records can all be erased.
 for item in 1..4 loop
  r:=(public.create_registration(body||jsonb_build_object('mobile','830000001'||item,'aadhar_fingerprint',repeat(item::text,64),'onboarding_employee_id',employee,'cash_received',item=3))->>'id')::uuid;
  pending_ids:=array_append(pending_ids,r);
  if item<>3 then
   reserved:=public.prepare_payment_order(r);
   if item<>1 then perform public.record_payment_order(r,'order_pending_erase_'||item,(reserved->>'requestKey')::uuid); end if;
  end if;
  if item=4 then update public.registrations set status='payment_exception' where id=r; end if;
 end loop;
 select to_jsonb(c) into snapshot from public.cash_collections c where registration_id=pending_ids[3];
 perform public.admin_bulk_action(sa,pending_ids,'trash','Erase pending test profiles');
 result:=public.purge_admin_registrations(sa,pending_ids,'test-password');assert (result->>'changed')::integer=4;
 assert not exists(select 1 from public.registrations where id=any(pending_ids) and (erased_at is null or person_id is not null));
 assert (public.get_dashboard(employee)->>'cashPending')::integer=0;
 assert public.get_dashboard(employee)->'pendingOnboardings'='[]'::jsonb;
 assert not exists(select 1 from private.registration_archives where registration_id=any(pending_ids));
 assert not exists(select 1 from public.persons where mobile like '830000001%');
 assert not exists(select 1 from public.registration_plots where registration_id=any(pending_ids));
 assert not exists(select 1 from private.person_identifiers where aadhar_fingerprint in(repeat('1',64),repeat('2',64),repeat('3',64),repeat('4',64)));
 assert (select to_jsonb(c) from public.cash_collections c where registration_id=pending_ids[3])=snapshot;
 assert (select count(*) from private.checkout_orders where registration_id=any(pending_ids))=3;
 assert public.get_admin_record(sa,pending_ids[2]) is null;
 assert public.get_admin_registration(sa,pending_ids[2])->>'name'='Deleted farmer';
 denied:=false;begin perform public.prepare_payment_order(pending_ids[2]);exception when others then denied:=sqlerrm='Registration was permanently deleted';end;assert denied;
 -- An order request already in flight may bind its result, preserving webhook linkage.
 result:=public.record_payment_order(pending_ids[1],'order_pending_erase_1',(select request_key from private.checkout_orders where registration_id=pending_ids[1]));
 assert result->>'erasedAt' is not null;
 assert public.get_checkout(pending_ids[1])->>'erasedAt' is not null;
 for item in 1..2 loop
  result:=public.record_payment_event('event_pending_erase_'||item,'payment.captured','order_pending_erase_'||item,'pay_pending_erase_'||item,50000,'INR','{}');
  assert (result->>'paymentException')::boolean;
  result:=public.record_payment_event('event_pending_erase_'||item,'payment.captured','order_pending_erase_'||item,'pay_pending_erase_'||item,50000,'INR','{}');
  assert (result->>'duplicate')::boolean;
  result:=public.finalize_registration_payment('order_pending_erase_'||item,'pay_pending_erase_'||item,50000,'INR','farmer',true);
  assert (result->>'paymentException')::boolean;
 end loop;
 assert (select count(*) from public.payment_attempts pa join public.payment_orders o on o.id=pa.payment_order_id where o.registration_id=any(pending_ids))=2;
 assert (select count(*) from public.payment_orders where registration_id=any(pending_ids) and status='paid')=2;
 assert (select count(*) from public.audit_events where action='payment_verification_requires_review' and details->>'reason'='registration_erased' and target_id in(select pa.id::text from public.payment_attempts pa join public.payment_orders o on o.id=pa.payment_order_id where o.registration_id=any(pending_ids)))=2;
 assert public.get_admin_page(sa,'exceptions')->'rows' @> jsonb_build_array(jsonb_build_object('registrationId',pending_ids[2]));
 assert not exists(select 1 from public.farmers where registration_id=any(pending_ids));
 assert not exists(select 1 from public.memberships where registration_id=any(pending_ids));
 assert not exists(select 1 from public.receipts where registration_id=any(pending_ids));
 assert not exists(select 1 from public.referral_earnings where registration_id=any(pending_ids));
 result:=public.purge_admin_registrations(sa,pending_ids,'test-password');assert (result->>'changed')::integer=0;
 -- Erased identity can register again; old captures cannot attach to the new account.
 result:=public.create_registration(body||jsonb_build_object('mobile','8300000012','aadhar_fingerprint',repeat('2',64)));
 assert (result->>'id')::uuid<>pending_ids[2];
 select p.account_id into account from public.persons p join public.registrations g on g.person_id=p.id where g.id=(result->>'id')::uuid;
 assert (select status from public.accounts where id=account)='pending_payment';
end $$;
rollback;
