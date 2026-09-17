-- Isolated database only; all fixtures roll back.
begin;
do $$
declare
 manager uuid:=gen_random_uuid(); employee uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
 body jsonb; result jsonb; reservation jsonb; reg uuid; farmer uuid; legacy uuid; denied boolean; first_plot text;
begin
 insert into public.accounts(id,mobile,password_hash,display_name,status) values
 (manager,'8900000001','synthetic','Multi manager','active'),
 (employee,'8900000002','synthetic','Multi employee','active'),
 (outsider,'8900000003','synthetic','Other employee','active');
 insert into public.account_roles(account_id,role) values(manager,'super_admin'),(employee,'employee'),(outsider,'employee');
 body:=jsonb_build_object('name','Multi Farmer','mobile','8900000004','password','test-password',
 'date_of_birth','1990-01-01','village','Test','district','dharashiv','taluka','dharashiv',
 'income_source','agriculture','cluster_type','pulses','aadhar_fingerprint',repeat('e',64),
 'aadhar_ciphertext','synthetic-only','aadhar_last_four','0004','consent',true,'onboarding_employee_id',employee,
 'plots','[{"plot_no":"MULTI-1","area_acres":2,"crop_names":["तूर","हरभरा"],"irrigation_sources":["well","drip"]},
           {"plot_no":"MULTI-2","area_acres":1,"crop_names":["मूग"],"irrigation_sources":["rainfed"]}]'::jsonb);
 reg:=(public.create_registration(body)->>'id')::uuid;
 assert (public.create_registration(body)->>'id')::uuid=reg,'Retry changed registration';
 assert (select crop_names=array['तूर','हरभरा'] and irrigation_sources=array['well','drip'] from public.registration_plots where registration_id=reg and plot_no='MULTI-1'),'Registration lost choices';
 -- Plots created together share a timestamp; their UUID tie-breaker is random.
 -- Exercise both return orders and identify each plot by its survey number.
 foreach first_plot in array array['MULTI-2','MULTI-1'] loop
  update public.registration_plots
   set created_at=now()+case when plot_no=first_plot then interval '0 seconds' else interval '1 second' end
   where registration_id=reg;
  result:=public.get_admin_record(manager,reg)->'plots';
  assert jsonb_array_length(result)=2 and result->0->>'plotNo'=first_plot,'Expected plot order not exercised';
  assert (select plot->'cropNames'='["तूर","हरभरा"]'::jsonb and plot->'irrigationSources'='["well","drip"]'::jsonb
   from jsonb_array_elements(result) plot where plot->>'plotNo'='MULTI-1'),'Admin lost MULTI-1 choices';
  assert (select plot->'cropNames'='["मूग"]'::jsonb and plot->'irrigationSources'='["rainfed"]'::jsonb
   from jsonb_array_elements(result) plot where plot->>'plotNo'='MULTI-2'),'Admin lost MULTI-2 choices';
 end loop;
 assert not exists(select 1 from public.farmers where registration_id=reg),'Premature farmer';
 reservation:=public.prepare_payment_order(reg);
 perform public.record_payment_order(reg,'order_multi_select',(reservation->>'requestKey')::uuid);
 result:=public.finalize_registration_payment('order_multi_select','pay_multi_select',50000,'INR','farmer',true);
 assert result?'receiptToken','Missing receipt';
 perform public.record_payment_event('evt_multi_select','payment.captured','order_multi_select','pay_multi_select',50000,'INR','{}');
 perform public.finalize_registration_payment('order_multi_select','pay_multi_select',50000,'INR','farmer',true);
 select id into farmer from public.farmers where registration_id=reg;
 assert (select count(*) from public.farmer_plots where farmer_id=farmer)=2,'Retry duplicated plots';
 assert not exists(select 1 from public.farmer_plots fp join public.registration_plots rp on rp.id=fp.source_registration_plot_id where fp.farmer_id=farmer and (fp.crop_names<>rp.crop_names or fp.irrigation_sources<>rp.irrigation_sources)),'Finalization lost choices';
 assert (public.get_farmer_detail(employee,farmer)->'plots') @> '[{"cropNames":["तूर","हरभरा"],"irrigationSources":["well","drip"]}]'::jsonb,'Employee view lost choices';
 denied:=false;
 begin perform public.get_farmer_detail(outsider,farmer); exception when others then denied:=true; end;
 assert denied,'Other employee could read plots';
 assert (select count(*) from public.receipts where registration_id=reg)=1,'Duplicate receipt';
 -- Old clients still submit scalar fields and receive arrays in reads.
 body:=body||jsonb_build_object('mobile','8900000005','aadhar_fingerprint',repeat('f',64),
 'plots','[{"plot_no":"LEGACY","area_acres":1,"crop_name":"Historical crop","irrigation_source":"well"}]'::jsonb);
 legacy:=(public.create_registration(body)->>'id')::uuid;
 assert (select crop_names=array['Historical crop'] and irrigation_sources=array['well'] from public.registration_plots where registration_id=legacy),'Legacy registration failed';
 -- Database constraints protect both plot tables against malformed arrays.
 denied:=false;
 begin update public.registration_plots set crop_names=array['तूर','तूर'] where registration_id=reg and plot_no='MULTI-1'; exception when check_violation then denied:=true; end;
 assert denied,'Duplicate crops accepted';
 denied:=false;
 begin update public.registration_plots set irrigation_sources=array[]::text[] where registration_id=reg; exception when check_violation then denied:=true; end;
 assert denied,'Empty sources accepted';
 denied:=false;
 begin update public.farmer_plots set irrigation_sources=array['well','invalid'] where farmer_id=farmer; exception when check_violation then denied:=true; end;
 assert denied,'Unknown irrigation accepted';
 denied:=false;
 begin update public.farmer_plots set crop_names=array[null]::text[] where farmer_id=farmer; exception when check_violation then denied:=true; end;
 assert denied,'Null crop accepted';
end;
$$;
rollback;
