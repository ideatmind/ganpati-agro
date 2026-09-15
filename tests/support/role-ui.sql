-- Synthetic fixtures for a fresh isolated role UI test database only.
insert into public.accounts(id,mobile,password_hash,display_name,status) values
('41000000-0000-4000-8000-000000000001','6800000001',extensions.crypt('role test password',extensions.gen_salt('bf',4)),'Role Super Administrator','active'),
('41000000-0000-4000-8000-000000000002','6800000002',extensions.crypt('role test password',extensions.gen_salt('bf',4)),'Role Manager','active'),
('41000000-0000-4000-8000-000000000003','6800000003',extensions.crypt('role test password',extensions.gen_salt('bf',4)),'Role Employee','active'),
('41000000-0000-4000-8000-000000000004','6800000004',extensions.crypt('role test password',extensions.gen_salt('bf',4)),'Role Referrer','active'),
('41000000-0000-4000-8000-000000000005','6800000005',extensions.crypt('role test password',extensions.gen_salt('bf',4)),'Other Employee','active');
insert into public.account_roles(account_id,role) values
('41000000-0000-4000-8000-000000000001','super_admin'),
('41000000-0000-4000-8000-000000000001','manager'),
('41000000-0000-4000-8000-000000000002','manager'),
('41000000-0000-4000-8000-000000000003','employee'),
('41000000-0000-4000-8000-000000000004','farmer_referrer'),
('41000000-0000-4000-8000-000000000005','employee');
insert into public.referrer_profiles(account_id,referral_code) select id,'ROLEUI'||right(mobile,4) from public.accounts where mobile like '68000000%';
do $$
declare body jsonb; r jsonb; pending jsonb; id uuid; i integer;
begin
 body:=jsonb_build_object('name','Role Farmer','mobile','6800000011','password','role test password','date_of_birth','1990-01-01','village','Test village','district','dharashiv','taluka','dharashiv','income_source','agriculture','cluster_type','pulses','aadhar_fingerprint',repeat('a',64),'aadhar_ciphertext','encrypted-synthetic-only','aadhar_last_four','0011','consent',true,'referral_code','ROLEUI0004','onboarding_employee_id','41000000-0000-4000-8000-000000000003','plots',jsonb_build_array(jsonb_build_object('plot_no','ROLE-1','area_acres',2,'crop_name','तूर','irrigation_source','well')));
 for i in 1..3 loop
  r:=public.create_registration(body||jsonb_build_object('name',case i when 1 then 'Role Farmer' when 2 then 'Other Farmer' else 'Pending Farmer' end,'mobile','680000001'||i,'aadhar_fingerprint',repeat(i::text,64),'cash_received',i=3,'onboarding_employee_id',case i when 2 then '41000000-0000-4000-8000-000000000005' else '41000000-0000-4000-8000-000000000003' end));
  id:=(r->>'id')::uuid;
  if i<3 then
   pending:=public.prepare_payment_order(id);perform public.record_payment_order(id,'order_roleui_'||i,(pending->>'requestKey')::uuid);
   perform public.finalize_registration_payment('order_roleui_'||i,'pay_roleui_'||i,(r->>'amountPaise')::integer,'INR','farmer',true);
  end if;
 end loop;
end $$;
