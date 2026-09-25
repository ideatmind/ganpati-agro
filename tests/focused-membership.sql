-- Disposable loopback database only. No real payment is made; all fixtures roll back.
begin;
create function pg_temp.expect_error(command text, expected text) returns void language plpgsql as $$
begin
 begin execute command; exception when others then
  if position(expected in sqlerrm)>0 then return; end if;
  raise;
 end;
 raise exception 'Expected rejection: %',expected;
end; $$;
do $$
declare
 admin uuid:=gen_random_uuid(); referrer uuid:=gen_random_uuid(); owner uuid; person uuid; farmer uuid;
 body jsonb; focus jsonb; standard jsonb; second jsonb; reserve jsonb; done jsonb; again jsonb; rows jsonb; detail jsonb;
 standard_id uuid; focused_id uuid; third_id uuid; public_token uuid; before_person jsonb; denied boolean;
begin
 assert public.get_registration_fee()=50000,'Default fee changed';
 assert public.get_membership_fee('standard')=50000;
 assert public.get_membership_fee('focused_value_chain')=250000;
 perform pg_temp.expect_error($q$select public.get_membership_fee('forged')$q$,'Invalid data');
 insert into public.accounts(id,mobile,password_hash,display_name,status) values
 (admin,'6500000001',extensions.crypt('membership test password',extensions.gen_salt('bf',4)),'Membership Admin','active'),
 (referrer,'6500000002',extensions.crypt('membership test password',extensions.gen_salt('bf',4)),'Membership Referrer','active');
 insert into public.account_roles(account_id,role) values(admin,'super_admin'),(referrer,'farmer_referrer');
 insert into public.referrer_profiles(account_id,referral_code) values(referrer,'FOCUSREF');
 body:=jsonb_build_object('name','Membership Test Farmer','mobile','6500000003','password','membership test password','date_of_birth','1990-01-01',
 'village','Test village','district','dharashiv','taluka','dharashiv','income_source','agriculture','cluster_type','pulses',
 'aadhar_fingerprint',repeat('a',64),'aadhar_ciphertext','synthetic-only','aadhar_last_four','0003','referral_code','FOCUSREF','consent',true,
 'plots',jsonb_build_array(jsonb_build_object('plot_no','FOCUS-1','area_acres',2,'crop_names',array['तूर'],'irrigation_sources',array['well'])));
 standard:=public.create_registration(body);standard_id:=(standard->>'id')::uuid;
 select p.account_id,p.id into owner,person from public.persons p join public.registrations g on g.person_id=p.id where g.id=standard_id;
 reserve:=public.prepare_payment_order(standard_id);
 perform public.record_payment_order(standard_id,'order_membership_standard',(reserve->>'requestKey')::uuid);
 done:=public.finalize_registration_payment('order_membership_standard','pay_membership_standard',50000,'INR','farmer',true);
 select id into farmer from public.farmers where person_id=person;
 select to_jsonb(p) into before_person from public.persons p where p.id=person;
 focus:=body||jsonb_build_object('membership_type','focused_value_chain','expected_fee_paise',250000,'cluster_type','fruits',
 'plots',jsonb_build_array(jsonb_build_object('plot_no','FOCUS-1','area_acres',2,'crop_names',array['डाळिंब','आंबा','पेरू','पपई'],'irrigation_sources',array['well','drip'])));
 perform pg_temp.expect_error(format('select public.create_membership_registration(%L::jsonb,null)',focus),'Sign in to add another membership');
 perform pg_temp.expect_error(format('select public.create_membership_registration(%L::jsonb,%L::uuid)',focus,referrer),'Sign in to add another membership');
 perform pg_temp.expect_error(format('select public.create_membership_registration(%L::jsonb,%L::uuid)',focus||'{"name":"Changed Name"}',owner),'Existing member details must match');
 perform pg_temp.expect_error(format('select public.create_membership_registration(%L::jsonb,%L::uuid)',focus||'{"expected_fee_paise":50000}',owner),'Registration fee changed');
 perform pg_temp.expect_error(format('select public.create_membership_registration(%L::jsonb,%L::uuid)',jsonb_set(focus,'{plots,0,crop_names}','["द्राक्ष"]'),owner),'Invalid focused membership crop');
 perform pg_temp.expect_error(format('select public.create_membership_registration(%L::jsonb,%L::uuid)',focus||jsonb_build_object('referral_code',(select referral_code from public.referrer_profiles where account_id=owner)),owner),'Self-referral');
 perform pg_temp.expect_error(format('select public.create_membership_registration(%L::jsonb,%L::uuid)',focus-'plots',owner),'One to ten plots');
 second:=public.create_membership_registration(focus,owner);focused_id:=(second->>'id')::uuid;
 assert (second->>'amountPaise')::integer=250000;
 assert (select count(*) from public.persons where account_id=owner)=1;
 assert (select count(*) from public.memberships where farmer_id=farmer)=1,'Activated before payment';
 assert before_person=(select to_jsonb(p) from public.persons p where id=person),'Existing profile changed through membership checkout';
 assert public.create_membership_registration(focus,owner)=second,'Retry created another focused checkout';
 assert public.create_registration(body)->>'id'=standard->>'id','Legacy retry resumed the wrong type';
 reserve:=public.prepare_payment_order(focused_id);
 perform public.record_payment_order(focused_id,'order_membership_focused',(reserve->>'requestKey')::uuid);
 perform pg_temp.expect_error($q$select public.finalize_registration_payment('order_membership_focused','pay_membership_focused',50000,'INR','farmer',true)$q$,'amount or currency');
 done:=public.record_payment_event('evt_membership_focused','payment.captured','order_membership_focused','pay_membership_focused',250000,'INR','{}');
 public_token:=(done->>'receiptToken')::uuid;
 again:=public.finalize_registration_payment('order_membership_focused','pay_membership_focused',250000,'INR','farmer',true);
 assert again->>'receiptToken'=done->>'receiptToken';
 perform public.record_payment_event('evt_membership_focused_duplicate','order.paid','order_membership_focused','pay_membership_focused',250000,'INR','{}');
 assert (select count(*) from public.farmers where person_id=person)=1,'Duplicated shared farmer';
 assert (select count(*) from public.memberships where farmer_id=farmer)=2;
 assert (select count(*) from public.receipts where registration_id=focused_id)=1;
 assert (select amount_paise from public.referral_earnings where registration_id=focused_id)=25000,'Wrong focused commission';
 assert (select amount_paise from public.referral_earnings where registration_id=standard_id)=5000,'Changed old commission';
 assert public.get_receipt(public_token)->>'membershipType'='focused_value_chain';
 assert not(public.get_receipt(public_token)::text like '%aadhar%');
 assert jsonb_array_length(public.get_dashboard(owner)->'memberships')=2;
 detail:=public.get_farmer_detail(admin,farmer);
 assert jsonb_array_length(detail->'memberships')=2,'Farmer reader does not support two memberships';
 assert jsonb_array_length(detail->'plots')=2,'Membership plot snapshots not retained';
 assert public.get_admin_record(admin,focused_id)->>'clusterType'='fruits';
 rows:=public.get_membership_admin_workspace(admin,'registrations','Membership Test Farmer',1,'','newest',null,null,25,'focused_value_chain');
 assert (rows->>'total')::integer=1;
 assert rows->'rows'->0->>'membershipType'='focused_value_chain';
 perform pg_temp.expect_error(format('update public.registrations set membership_type=''standard'' where id=%L',focused_id),'immutable');
 perform public.delete_membership_registrations(admin,'{}',true,'Membership Test Farmer','',null,null,1,'Focused test selection','membership test password','focused_value_chain');
 assert exists(select 1 from private.registration_archives where registration_id=focused_id);
 assert not exists(select 1 from private.registration_archives where registration_id=standard_id),'All matching ignored membership filter';
 perform pg_temp.expect_error(format('select public.purge_admin_registrations(%L,array[%L]::uuid[],%L)',admin,focused_id,'membership test password'),'Select all memberships');
 assert exists(select 1 from public.persons where id=person),'Partial purge erased shared person';
 perform public.delete_admin_registrations(admin,array[standard_id],false,'','',null,null,null,'Erase shared test profile',null);
 done:=public.purge_admin_registrations(admin,array[standard_id,focused_id],'membership test password');
 assert (done->>'changed')::integer=2;
 assert not exists(select 1 from public.persons where id=person);
 assert (select count(*) from public.receipts where registration_id in(standard_id,focused_id))=2;
 assert public.get_receipt(public_token)->>'membershipType'='focused_value_chain','Retained receipt lost membership type';
 assert (public.purge_admin_registrations(admin,array[standard_id,focused_id],'membership test password')->>'changed')::integer=0;

 -- A first-time focused member can later add standard membership, still without a duplicate farmer.
 focus:=focus||jsonb_build_object('mobile','6500000004','aadhar_fingerprint',repeat('b',64),'expected_fee_paise',250000,'cluster_type','allied',
 'plots',jsonb_build_array(jsonb_build_object('plot_no','ALLIED','area_acres',1,'crop_names',array['कुक्कुटपालन','शेळी पालन'],'irrigation_sources',array['other'])));
 second:=public.create_membership_registration(focus,null);third_id:=(second->>'id')::uuid;
 reserve:=public.prepare_payment_order(third_id);
 perform public.record_payment_order(third_id,'order_membership_allied',(reserve->>'requestKey')::uuid);
 perform public.finalize_registration_payment('order_membership_allied','pay_membership_allied',250000,'INR','farmer',true);
 select p.account_id,p.id into owner,person from public.persons p join public.registrations g on g.person_id=p.id where g.id=third_id;
 standard:=public.create_membership_registration(focus||jsonb_build_object('membership_type','standard','expected_fee_paise',50000),owner);
 reserve:=public.prepare_payment_order((standard->>'id')::uuid);
 perform public.record_payment_order((standard->>'id')::uuid,'order_membership_reverse',(reserve->>'requestKey')::uuid);
 perform public.finalize_registration_payment('order_membership_reverse','pay_membership_reverse',50000,'INR','farmer',true);
 assert (select count(*) from public.farmers where person_id=person)=1;
 assert (select count(*) from public.memberships m join public.farmers f on f.id=m.farmer_id where f.person_id=person)=2;
 assert not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute')));
 raise notice 'Focused membership pricing, identity, authorization, capture, retry, referral, reader, filter and shared-erasure regressions passed.';
end; $$;
rollback;
