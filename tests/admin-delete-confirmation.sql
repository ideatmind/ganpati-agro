begin;
do $$
declare sa uuid:=gen_random_uuid(); other_sa uuid:=gen_random_uuid(); mgr uuid:=gen_random_uuid(); account uuid; person uuid; registration uuid; ids uuid[]:='{}'; result jsonb; denied boolean; body jsonb;
begin
 insert into public.accounts(id,mobile,password_hash,display_name,status) values
 (sa,'8300000001',extensions.crypt('12345678',extensions.gen_salt('bf',4)),'Delete super','active'),
 (other_sa,'8300000002',extensions.crypt('87654321',extensions.gen_salt('bf',4)),'Other super','active'),
 (mgr,'8300000003',extensions.crypt('12345678',extensions.gen_salt('bf',4)),'Delete manager','active');
 insert into public.account_roles(account_id,role) values(sa,'super_admin'),(other_sa,'super_admin'),(mgr,'manager');
 for i in 1..101 loop
  insert into public.accounts(mobile,password_hash,display_name) values('831'||lpad(i::text,7,'0'),'unused-synthetic-hash','Delete fixture') returning id into account;
  insert into public.persons(account_id,name,mobile,date_of_birth,village,taluka,district,income_source,cluster_type) values(account,'Delete confirmation fixture','831'||lpad(i::text,7,'0'),'1990-01-01','Test','dharashiv','dharashiv','agriculture','pulses') returning id into person;
  insert into public.registrations(reference,person_id,fee_version_id,fee_amount_paise,commission_rate_id,commission_basis_points,channel,payment_mode,consent_given) values('DELETE-FIXTURE-'||i,person,(select id from public.fee_versions limit 1),50000,(select id from public.commission_rate_versions limit 1),1000,'public','farmer_online',true) returning id into registration;
  ids:=array_append(ids,registration);
 end loop;
 result:=public.delete_admin_registrations(sa,ids[1:25],false,'','',null,null,null,'Boundary 25',null);assert (result->>'changed')::integer=25;
 perform public.admin_bulk_action(sa,ids[1:25],'restore');
 denied:=false;begin perform public.delete_admin_registrations(sa,ids[1:26],false,'','',null,null,null,'Boundary 26',null);exception when others then denied:=sqlerrm='Password confirmation required';end;assert denied;
 denied:=false;begin perform public.admin_bulk_action(sa,ids[1:26],'trash','Bypass attempt');exception when others then denied:=sqlerrm='Password confirmation required';end;assert denied;
 denied:=false;begin perform public.delete_admin_registrations(sa,ids[1:26],false,'','',null,null,null,'Wrong password','87654321');exception when others then denied:=sqlerrm='Incorrect confirmation password';end;assert denied,'Another admins password was accepted';
 assert not exists(select 1 from private.registration_archives where registration_id=any(ids));
 result:=public.delete_admin_registrations(sa,ids[1:26],false,'','',null,null,null,'Correct password','12345678');assert (result->>'changed')::integer=26;
 perform public.admin_bulk_action(sa,ids[1:26],'restore');
 denied:=false;begin perform public.delete_admin_registrations(mgr,'{}',true,'DELETE-FIXTURE-','',null,null,101,'Manager attempt','12345678');exception when others then denied:=sqlerrm='Not authorized';end;assert denied;
 denied:=false;begin perform public.delete_admin_registrations(sa,'{}',true,'DELETE-FIXTURE-','',null,null,100,'Stale selection','12345678');exception when others then denied:=sqlerrm='Selection changed';end;assert denied;
 denied:=false;begin perform public.delete_admin_registrations(sa,'{}',true,'DELETE-FIXTURE-','',null,null,101,'All without password',null);exception when others then denied:=sqlerrm='Password confirmation required';end;assert denied;
 result:=public.delete_admin_registrations(sa,'{}',true,'DELETE-FIXTURE-','',null,null,101,'All matching','12345678');assert (result->>'changed')::integer=101;
 assert (select count(*) from public.registrations where id=any(ids))=101;
 assert (select count(*) from public.audit_events where actor_account_id=sa and action='registration_trashed' and details::text like '%12345678%')=0;
 perform public.admin_bulk_action(sa,ids[1:100],'restore');perform public.admin_bulk_action(sa,ids[101:101],'restore');
 result:=public.get_admin_workspace(sa,'registrations','DELETE-FIXTURE-');assert (result->>'total')::integer=101;
 body:=jsonb_build_object('name','Eight character farmer','mobile','8300000004','password','12345678','date_of_birth','1990-01-01','village','Test','district','dharashiv','taluka','dharashiv','income_source','agriculture','cluster_type','pulses','aadhar_fingerprint',repeat('9',64),'aadhar_ciphertext','synthetic-only','aadhar_last_four','0004','consent',true,'plots',jsonb_build_array(jsonb_build_object('plot_no','1','area_acres',1,'crop_name','Test','irrigation_source','well')));
 result:=public.create_registration(body);assert result->>'id' is not null;
 denied:=false;begin perform public.create_registration(body||jsonb_build_object('mobile','8300000005','password','1234567','aadhar_fingerprint',repeat('a',64)));exception when others then denied:=true;end;assert denied;
 result:=public.create_staff_account(sa,'Eight char employee','8300000006','12345678','employee');assert result->>'id' is not null;
 denied:=false;begin perform public.create_staff_account(sa,'Seven char employee','8300000007','1234567','employee');exception when others then denied:=true;end;assert denied;
 perform public.change_account_password(sa,'12345678','abcdefgh');
 denied:=false;begin perform public.change_account_password(sa,'abcdefgh','1234567');exception when others then denied:=true;end;assert denied;
 assert not has_function_privilege('anon','public.delete_admin_registrations(uuid,uuid[],boolean,text,text,date,date,integer,text,text)','execute');
end $$;
rollback;
