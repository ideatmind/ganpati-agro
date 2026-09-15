begin;
do $$
declare sa uuid:=gen_random_uuid(); emp uuid:=gen_random_uuid(); other_emp uuid:=gen_random_uuid(); r uuid; r2 uuid; fid uuid; profile uuid; result jsonb; payload jsonb; denied boolean; saved_receipt jsonb; tbl text;
begin
 insert into public.accounts(id,mobile,password_hash,display_name,status) values
 (sa,'8300000001',extensions.crypt('audit-password',extensions.gen_salt('bf',4)),'Audit super','active'),
 (emp,'8300000002',extensions.crypt('audit-password',extensions.gen_salt('bf',4)),'Audit employee','active'),
 (other_emp,'8300000003',extensions.crypt('audit-password',extensions.gen_salt('bf',4)),'Other employee','active');
 insert into public.account_roles(account_id,role) values(sa,'super_admin'),(emp,'employee'),(other_emp,'employee');
 insert into public.referrer_profiles(account_id,referral_code) values(emp,'AUDITEMP') returning id into profile;
 payload:=jsonb_build_object('name','Audit Farmer','mobile','8300000004','password','audit-password','date_of_birth','1990-01-01','village','Test village','district','dharashiv','taluka','dharashiv','income_source','agriculture','cluster_type','pulses','aadhar_fingerprint',repeat('d',64),'aadhar_ciphertext','encrypted-audit-fixture','aadhar_last_four','0004','consent',true,'onboarding_employee_id',emp,'cash_received',true,'expected_fee_paise',50000,'plots',jsonb_build_array(jsonb_build_object('plot_no','AUDIT-1','area_acres',2,'crop_name','Pulses','irrigation_source','well')));
 assert public.get_registration_fee()=50000;
 denied:=false;begin perform public.create_registration(payload||jsonb_build_object('expected_fee_paise',1));exception when others then denied:=sqlerrm='Registration fee changed';end;assert denied,'Stale displayed price accepted';
 r:=(public.create_registration(payload)->>'id')::uuid;
 result:=public.get_dashboard(emp);assert (result->>'cashPending')::int=1;assert jsonb_array_length(result->'pendingOnboardings')=1;
 result:=public.get_dashboard(other_emp);assert (result->>'cashPending')::int=0;assert jsonb_array_length(result->'pendingOnboardings')=0;
 denied:=false;begin update public.cash_collections set amount_paise=1 where registration_id=r;exception when others then denied:=true;end;assert denied;
 denied:=false;begin delete from public.cash_collections where registration_id=r;exception when others then denied:=true;end;assert denied;
 result:=public.prepare_payment_order(r);perform public.record_payment_order(r,'order_audit_controls',(result->>'requestKey')::uuid);
 denied:=false;begin update public.payment_orders set amount_paise=1 where registration_id=r;exception when others then denied:=true;end;assert denied;
 perform public.record_payment_event('event_audit_controls','payment.captured','order_audit_controls','pay_audit_controls',50000,'INR','{}');
 select id into fid from public.farmers where registration_id=r;
 denied:=false;begin update public.payment_events set payload='{}' where provider_event_id='event_audit_controls';exception when others then denied:=true;end;assert denied;
 denied:=false;begin update public.payment_orders set status='created' where registration_id=r;exception when others then denied:=true;end;assert denied;
 denied:=false;begin perform public.update_farmer_profile(other_emp,fid,'{"name":"Other Farmer"}');exception when others then denied:=true;end;assert denied;
 select to_jsonb(x) into saved_receipt from public.receipts x where registration_id=r;
 perform public.admin_bulk_action(sa,array[r],'trash','Audit erasure');perform public.purge_admin_registrations(sa,array[r],'audit-password');
 result:=public.get_admin_registration(sa,r);assert result->>'name'='Deleted farmer';assert result->'orders'->0->>'providerOrderId'='order_audit_controls';
 assert public.get_admin_record(sa,r) is null,'Finance fallback exposed erased personal profile';
 denied:=false;begin perform public.get_admin_registration(emp,r);exception when others then denied:=true;end;assert denied;
 result:=public.get_dashboard(emp);assert result->'recentEarnings'->0->>'farmerName'='Deleted farmer';assert (result->>'earnedPaise')::int=5000;
 perform public.finalize_registration_payment('order_audit_controls','pay_audit_controls',50000,'INR','farmer',true);
 assert (select to_jsonb(x) from public.receipts x where registration_id=r)=saved_receipt;
 -- Changing future fees does not rewrite an old registration or receipt.
 insert into public.fee_versions(amount_paise,effective_from) values(100,now()+interval '1 second');
 update public.fee_versions set effective_from=now() where amount_paise=100;
 assert public.get_registration_fee()=100;
 r2:=(public.create_registration(payload||jsonb_build_object('expected_fee_paise',100))->>'id')::uuid;
 assert (select fee_amount_paise from public.registrations where id=r2)=100;
 assert (select amount_paise from public.cash_collections where registration_id=r2)=100;
 assert (select fee_amount_paise from public.registrations where id=r)=50000;
 foreach tbl in array array['cash_collections','payment_orders','payment_events','payout_allocations'] loop
  assert not has_table_privilege('service_role','public.'||tbl,'UPDATE');
  assert not has_table_privilege('service_role','public.'||tbl,'DELETE');
  assert not has_table_privilege('service_role','public.'||tbl,'TRUNCATE');
 end loop;
 assert not has_function_privilege('anon','public.get_registration_fee()','execute');
 assert has_function_privilege('service_role','public.get_registration_fee()','execute');
end $$;
rollback;
