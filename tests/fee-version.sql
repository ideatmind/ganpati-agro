-- Isolated transactional regression: preserve a previously quoted fee.
begin;
do $$
declare body jsonb; old_registration jsonb; new_registration jsonb;
begin
  update public.fee_versions set effective_to=now() where effective_from<now() and effective_to is null;
  insert into public.fee_versions(amount_paise,effective_from) values(50000,now()-interval '1 second');
  body:=jsonb_build_object('name','Fee snapshot test','mobile','8400000001','password','test1234','date_of_birth','1990-01-01','village','Test','district','dharashiv','taluka','dharashiv','income_source','agriculture','cluster_type','pulses','aadhar_fingerprint',repeat('4',64),'aadhar_ciphertext','synthetic','aadhar_last_four','0001','consent',true,'plots',jsonb_build_array(jsonb_build_object('plot_no','1','area_acres',1,'crop_name','तूर','irrigation_source','well')));
  old_registration:=public.create_registration(body);
  assert (old_registration->>'amountPaise')::int=50000,'Previous quote incorrect';
  insert into public.fee_versions(amount_paise,effective_from) values(100,now());
  new_registration:=public.create_registration(body||jsonb_build_object('mobile','8400000002','aadhar_fingerprint',repeat('5',64)));
  assert (new_registration->>'amountPaise')::int=100,'New quote must be INR 1';
  assert (public.get_checkout((old_registration->>'id')::uuid)->>'amountPaise')::int=50000,'Existing quote was repriced';
end;
$$;
rollback;
