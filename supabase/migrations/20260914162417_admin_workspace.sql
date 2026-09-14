begin;
alter default privileges revoke execute on functions from public,anon,authenticated;

-- Trash is an operational view, never deletion of registrations or financial history.
create table private.registration_archives (
 registration_id uuid primary key references public.registrations(id) on delete restrict,
 archived_by uuid not null references public.accounts(id),
 archived_at timestamptz not null default now(),
 reason text not null check(length(reason) between 3 and 300)
);
alter table private.registration_archives enable row level security;
revoke all on private.registration_archives from public,anon,authenticated;
create index registration_archives_actor_idx on private.registration_archives(archived_by);

create function public.get_admin_workspace(p_actor_id uuid,p_section text default 'overview',p_query text default '',p_page integer default 1,p_status text default '',p_sort text default 'newest',p_from date default null,p_to date default null,p_size integer default 25)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; summary jsonb; items jsonb; total bigint; q text:=trim(p_query); off integer;
begin
 if not private.has_role(p_actor_id,array['manager','super_admin']) then raise exception 'Not authorized'; end if;
 if p_section is null or p_section not in ('overview','registrations','trash','staff','referrers','payouts','exceptions','grants','audit') or p_page is null or p_page<1 or p_page>10000 or p_size is null or p_size not in (25,50,100) or q is null or length(q)>100 or p_status is null or p_status not in ('','payment_pending','processing','completed','payment_exception') or p_sort is null or p_sort not in ('newest','oldest','name') or (p_from is not null and p_to is not null and p_from>p_to) then raise exception 'Invalid data' using errcode='23514'; end if;
 if p_section='trash' and not private.has_role(p_actor_id,array['super_admin']) then raise exception 'Not authorized'; end if;
 if p_section not in ('overview','registrations','trash') then return public.get_admin_page(p_actor_id,p_section,q,p_page); end if;
 select jsonb_build_object('total',count(*),'completed',count(*) filter(where status='completed'),'pending',count(*) filter(where status<>'completed'),'today',count(*) filter(where created_at>=(now() at time zone 'Asia/Kolkata')::date at time zone 'Asia/Kolkata'),'trash',(select count(*) from private.registration_archives)) into summary from public.registrations;
 off:=(p_page-1)*p_size;
 select count(*) into total from public.registrations g join public.persons p on p.id=g.person_id
 where (exists(select 1 from private.registration_archives ar where ar.registration_id=g.id))=(p_section='trash')
 and (q='' or p.name ilike q||'%' or p.mobile=q or g.reference ilike q||'%')
 and (p_status='' or g.status=p_status) and (p_from is null or g.created_at>=p_from::timestamp at time zone 'Asia/Kolkata') and (p_to is null or g.created_at<(p_to+1)::timestamp at time zone 'Asia/Kolkata');
 execute format($list$select coalesce(jsonb_agg(x),'[]') from (
  select g.id,p.name as label,g.reference,g.status,g.fee_amount_paise as "amountPaise",g.created_at as "createdAt",case when $1 then p.mobile else '******'||right(p.mobile,4) end as mobile,f.id as "farmerId",a.display_name as actor,p.village,p.district,ar.archived_at as "archivedAt"
  from public.registrations g join public.persons p on p.id=g.person_id left join public.farmers f on f.registration_id=g.id left join public.accounts a on a.id=g.onboarding_employee_id left join private.registration_archives ar on ar.registration_id=g.id
  where (ar.registration_id is not null)=($2='trash') and ($3='' or p.name ilike $3||'%%' or p.mobile=$3 or g.reference ilike $3||'%%')
  and ($4='' or g.status=$4) and ($5 is null or g.created_at>=$5::timestamp at time zone 'Asia/Kolkata') and ($6 is null or g.created_at<($6+1)::timestamp at time zone 'Asia/Kolkata')
  order by %s,g.id desc
  limit case when $2='overview' then 6 else $7 end offset $8
 ) x$list$,case p_sort when 'name' then 'p.name ASC' when 'oldest' then 'g.created_at ASC' else 'g.created_at DESC' end) into items using private.has_role(p_actor_id,array['super_admin']),p_section,q,p_status,p_from,p_to,p_size,off; return jsonb_build_object('summary',summary,'rows',items,'total',total,'page',p_page,'hasNext',p_section<>'overview' and total>off+p_size);
end; $$;

create function public.get_admin_record(p_actor_id uuid,p_registration_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; extra jsonb;
begin
 result:=public.get_admin_registration(p_actor_id,p_registration_id);
 if result is null then return null; end if;
 select jsonb_build_object('mobile',case when private.has_role(p_actor_id,array['super_admin']) then p.mobile else '******'||right(p.mobile,4) end,'dateOfBirth',p.date_of_birth,'village',p.village,'district',p.district,'taluka',p.taluka,'incomeSource',p.income_source,'clusterType',p.cluster_type,'consentGiven',g.consent_given,'channel',g.channel,'commissionBasisPoints',g.commission_basis_points,'accountStatus',ac.status,'aadhaarLastFour',case when private.has_role(p_actor_id,array['super_admin']) then pi.aadhar_last_four else null end,
 'archivedAt',ar.archived_at,'archiveReason',ar.reason,'archivedBy',archiver.display_name,
 'cash',case when c.id is null then null else jsonb_build_object('amountPaise',c.amount_paise,'receivedAt',c.received_at,'note',c.note) end,
 'plots',coalesce((select jsonb_agg(jsonb_build_object('id',pl.id,'plotNo',pl.plot_no,'areaAcres',pl.area_acres,'cropName',pl.crop_name,'irrigationSource',pl.irrigation_source) order by pl.created_at,pl.id) from public.registration_plots pl where pl.registration_id=g.id),'[]'::jsonb)) into extra
 from public.registrations g join public.persons p on p.id=g.person_id join public.accounts ac on ac.id=p.account_id left join private.person_identifiers pi on pi.person_id=p.id left join public.cash_collections c on c.registration_id=g.id left join private.registration_archives ar on ar.registration_id=g.id left join public.accounts archiver on archiver.id=ar.archived_by where g.id=p_registration_id;
 return result||extra;
end; $$;

create function public.read_admin_aadhaar(p_actor_id uuid,p_registration_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare encrypted text;
begin
 if not private.has_role(p_actor_id,array['super_admin']) then raise exception 'Not authorized'; end if;
 select pi.aadhar_ciphertext into encrypted from private.person_identifiers pi join public.registrations g on g.person_id=pi.person_id where g.id=p_registration_id;
 if encrypted is null then return null; end if;
 insert into public.audit_events(actor_account_id,action,target_type,target_id) values(p_actor_id,'aadhaar_viewed','registration',p_registration_id::text);
 return encrypted;
end; $$;

create function public.admin_bulk_action(p_actor_id uuid,p_ids uuid[],p_action text,p_reason text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare item uuid; changed integer:=0;
begin
 if not private.has_role(p_actor_id,array['manager','super_admin']) then raise exception 'Not authorized'; end if;
 if p_action is null or p_action not in ('trash','restore','activate','deactivate','revoke') or p_ids is null or cardinality(p_ids)<1 or cardinality(p_ids)>100 or array_position(p_ids,null) is not null then raise exception 'Invalid data' using errcode='23514'; end if;
 if p_action<>'revoke' and not private.has_role(p_actor_id,array['super_admin']) then raise exception 'Not authorized'; end if;
 if p_action='trash' and (p_reason is null or length(trim(p_reason))<3 or length(p_reason)>300) then raise exception 'Invalid data' using errcode='23514'; end if;
 -- Sorted locks make concurrent selections deterministic. Any invalid item rolls back the batch.
 for item in select distinct unnest(p_ids) order by 1 loop
  if p_action in ('trash','restore') then
   perform 1 from public.registrations where id=item for update;
   if not found then raise exception 'Invalid data' using errcode='23514'; end if;
   if p_action='trash' then
    insert into private.registration_archives(registration_id,archived_by,reason) values(item,p_actor_id,trim(p_reason)) on conflict do nothing;
   else delete from private.registration_archives where registration_id=item; end if;
   if found then
    changed:=changed+1;
    insert into public.audit_events(actor_account_id,action,target_type,target_id) values(p_actor_id,case when p_action='trash' then 'registration_trashed' else 'registration_restored' end,'registration',item::text);
   end if;
  elsif p_action in ('activate','deactivate') then
   perform public.set_staff_status(p_actor_id,item,case when p_action='activate' then 'active' else 'disabled' end);changed:=changed+1;
  else
   if not exists(select 1 from public.temporary_permission_grants where id=item) then raise exception 'Invalid data' using errcode='23514'; end if;
   perform public.revoke_farmer_grant(p_actor_id,item);changed:=changed+1;
  end if;
 end loop;
 return jsonb_build_object('changed',changed);
end; $$;

revoke all on function public.get_admin_workspace(uuid,text,text,integer,text,text,date,date,integer),public.get_admin_record(uuid,uuid),public.read_admin_aadhaar(uuid,uuid),public.admin_bulk_action(uuid,uuid[],text,text) from public,anon,authenticated;
grant execute on function public.get_admin_workspace(uuid,text,text,integer,text,text,date,date,integer),public.get_admin_record(uuid,uuid),public.read_admin_aadhaar(uuid,uuid),public.admin_bulk_action(uuid,uuid[],text,text) to service_role;
commit;
