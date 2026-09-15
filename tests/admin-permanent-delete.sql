begin;
do $$
declare sa uuid:=gen_random_uuid(); mgr uuid:=gen_random_uuid(); r1 uuid; r2 uuid; r3 uuid; pid uuid; aid uuid; body jsonb; result jsonb; denied boolean; receipt jsonb; earning jsonb;
begin
 insert into public.accounts(id,mobile,password_hash,display_name,status) values
 (sa,'8200000001',extensions.crypt('test-password',extensions.gen_salt('bf',4)),'Purge super','active'),
 (mgr,'8200000002',extensions.crypt('test-password',extensions.gen_salt('bf',4)),'Purge manager','active');
 insert into public.account_roles(account_id,role) values(sa,'super_admin'),(mgr,'manager');
 insert into public.referrer_profiles(account_id,referral_code) values(mgr,'PURGETEST');
 body:=jsonb_build_object('name','Purge Farmer','mobile','8200000003','password','test-password','date_of_birth','1990-01-01','village','Test village','district','dharashiv','taluka','dharashiv','income_source','agriculture','cluster_type','pulses','aadhar_fingerprint',repeat('a',64),'aadhar_ciphertext','encrypted-purge-fixture','aadhar_last_four','0003','consent',true,'referral_code','PURGETEST','plots',jsonb_build_array(jsonb_build_object('plot_no','PURGE-1','area_acres',2,'crop_name','Pulses','irrigation_source','well')));
 r1:=(public.create_registration(body)->>'id')::uuid;
 r2:=(public.create_registration(body||jsonb_build_object('mobile','8200000004','aadhar_fingerprint',repeat('b',64)))->>'id')::uuid;
 r3:=(public.create_registration(body||jsonb_build_object('mobile','8200000005','aadhar_fingerprint',repeat('c',64)))->>'id')::uuid;
 result:=public.prepare_payment_order(r1);perform public.record_payment_order(r1,'order_purge',(result->>'requestKey')::uuid);
 perform public.finalize_registration_payment('order_purge','pay_purge',50000,'INR','farmer',true);
 select to_jsonb(r) into receipt from public.receipts r where registration_id=r1;
 select to_jsonb(e) into earning from public.referral_earnings e where registration_id=r1;
 select p.id,p.account_id into pid,aid from public.persons p join public.registrations g on g.person_id=p.id where g.id=r1;
 perform public.authenticate_account_session('8200000003','test-password',gen_random_uuid());
 denied:=false;begin perform public.purge_admin_registrations(mgr,array[r1],'test-password');exception when others then denied:=sqlerrm='Not authorized';end;assert denied;
 denied:=false;begin perform public.purge_admin_registrations(sa,array[r1],'wrong');exception when others then denied:=sqlerrm='Incorrect confirmation password';end;assert denied;
 denied:=false;begin perform public.purge_admin_registrations(sa,array[r1],null);exception when others then denied:=sqlerrm='Password confirmation required';end;assert denied;
 denied:=false;begin perform public.purge_admin_registrations(sa,array[r1],'test-password');exception when others then denied:=sqlerrm='Only trashed registrations can be permanently deleted';end;assert denied;
 perform public.admin_bulk_action(sa,array[r1,r2,r3],'trash','Purge test');
 perform public.prepare_payment_order(r3);
 denied:=false;begin perform public.purge_admin_registrations(sa,array[r1,r2,r3],'test-password');exception when others then denied:=sqlerrm='Unresolved checkout prevents permanent deletion';end;assert denied;
 assert exists(select 1 from public.persons where id=pid),'Failed batch erased profile';
 assert exists(select 1 from public.registrations where id=r2),'Failed batch deleted pending registration';
 result:=public.purge_admin_registrations(sa,array[r1,r2,r1],'test-password');assert (result->>'changed')::integer=2;
 assert not exists(select 1 from public.persons where id=pid);
 assert not exists(select 1 from private.person_identifiers where person_id=pid);
 assert not exists(select 1 from public.registration_plots where registration_id=r1);
 assert not exists(select 1 from public.farmer_plots fp join public.farmers f on f.id=fp.farmer_id where f.registration_id=r1);
 assert not exists(select 1 from private.account_sessions where account_id=aid);
 assert exists(select 1 from public.accounts where id=aid and mobile is null and erased_at is not null and status='disabled');
 assert public.authenticate_account('8200000003','test-password') is null;
 assert not exists(select 1 from public.registrations where id=r2);
 assert not exists(select 1 from private.registration_archives where registration_id in(r1,r2));
 assert public.get_admin_record(sa,r1) is null;
 assert public.read_admin_aadhaar(sa,r1) is null;
 assert (select to_jsonb(r) from public.receipts r where registration_id=r1)=receipt;
 assert (select to_jsonb(e) from public.referral_earnings e where registration_id=r1)=earning;
 perform public.finalize_registration_payment('order_purge','pay_purge',50000,'INR','farmer',true);
 perform public.record_payment_event('event_purge','payment.captured','order_purge','pay_purge',50000,'INR','{}'::jsonb);
 assert (select count(*) from public.memberships where registration_id=r1)=1;
 assert (select to_jsonb(r) from public.receipts r where registration_id=r1)=receipt;
 result:=public.purge_admin_registrations(sa,array[r1,r2],'test-password');assert (result->>'changed')::integer=0;
 assert (select count(*) from public.audit_events where action='registration_permanently_deleted' and target_id in(r1::text,r2::text))=2;
 denied:=false;begin perform public.admin_bulk_action(sa,array[r1],'trash','Stale client');exception when others then denied:=sqlerrm='Selection changed';end;assert denied;
 -- Original mobile and fingerprint are reusable after physical identity deletion.
 result:=public.create_registration(body);assert (result->>'id')::uuid<>r1;
 update public.accounts set status='disabled' where id=sa;
 denied:=false;begin perform public.purge_admin_registrations(sa,array[r3],'test-password');exception when others then denied:=sqlerrm='Not authorized';end;assert denied;
 assert not has_function_privilege('anon','public.purge_admin_registrations(uuid,uuid[],text)','execute');
 assert not has_function_privilege('authenticated','public.purge_admin_registrations(uuid,uuid[],text)','execute');
 assert has_function_privilege('service_role','public.purge_admin_registrations(uuid,uuid[],text)','execute');
end $$;
rollback;
