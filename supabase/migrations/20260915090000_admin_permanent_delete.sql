begin;

-- Retained accounting records can outlive the personal profile. NULL is only
-- permitted after explicit erasure; all existing financial immutability stays.
alter table public.accounts add column erased_at timestamptz;
alter table public.accounts alter column mobile drop not null;
alter table public.accounts add constraint accounts_erasure_check check (
 (erased_at is null and mobile is not null) or
 (erased_at is not null and mobile is null and status='disabled' and display_name='Deleted farmer' and password_hash='!erased')
);
alter table public.registrations add column erased_at timestamptz;
alter table public.registrations alter column person_id drop not null;
alter table public.registrations add constraint registrations_erasure_check check (
 (erased_at is null and person_id is not null) or (erased_at is not null and person_id is null and status='completed')
);
alter table public.farmers add column erased_at timestamptz;
alter table public.farmers alter column person_id drop not null;
alter table public.farmers add constraint farmers_erasure_check check (
 (erased_at is null and person_id is not null) or (erased_at is not null and person_id is null)
);

create function public.purge_admin_registrations(p_actor_id uuid,p_ids uuid[],p_password text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item uuid; g public.registrations; person uuid; account uuid; saved_hash text; changed integer:=0;
begin
 if not private.has_role(p_actor_id,array['super_admin']) then raise exception 'Not authorized'; end if;
 if p_ids is null or cardinality(p_ids) not between 1 and 100 or array_position(p_ids,null) is not null then raise exception 'Invalid data' using errcode='23514'; end if;
 if p_password is null or length(p_password)=0 then raise exception 'Password confirmation required'; end if;
 if octet_length(p_password)>72 then raise exception 'Incorrect confirmation password'; end if;
 select password_hash into saved_hash from public.accounts where id=p_actor_id and status='active' for share;
 if saved_hash is null or extensions.crypt(p_password,saved_hash)<>saved_hash then raise exception 'Incorrect confirmation password'; end if;

 -- Same registration locks as checkout, capture and restore. Failure rolls back
 -- the entire selection. Existing audit events make response-loss retries safe.
 for item in select distinct unnest(p_ids) order by 1 loop
  select * into g from public.registrations where id=item for update;
  if not found or g.erased_at is not null then
   if exists(select 1 from public.audit_events where action='registration_permanently_deleted' and target_type='registration' and target_id=item::text) then continue; end if;
   raise exception 'Selection changed';
  end if;
  perform 1 from private.registration_archives where registration_id=item for update;
  if not found then raise exception 'Only trashed registrations can be permanently deleted'; end if;
  if g.status<>'completed' and (g.status<>'payment_pending'
    or exists(select 1 from private.checkout_orders where registration_id=item)
    or exists(select 1 from public.payment_orders where registration_id=item)
    or exists(select 1 from public.cash_collections where registration_id=item)) then
   raise exception 'Unresolved checkout prevents permanent deletion';
  end if;
  person:=g.person_id;
  select account_id into account from public.persons where id=person for update;
  perform 1 from public.accounts where id=account for update;
  if account=p_actor_id or exists(select 1 from public.account_roles where account_id=account and role<>'farmer_referrer') then
   raise exception 'Staff accounts cannot be permanently deleted';
  end if;
  update public.referrer_profiles set active=false where account_id=account;
  delete from private.account_sessions where account_id=account;
  delete from public.account_roles where account_id=account;
  update public.accounts set mobile=null,display_name='Deleted farmer',password_hash='!erased',status='disabled',erased_at=now(),updated_at=now() where id=account;
  update public.temporary_permission_grants set revoked_at=coalesce(revoked_at,now()),revoked_by=coalesce(revoked_by,p_actor_id)
   where farmer_id in(select id from public.farmers where registration_id=item);
  delete from public.farmer_plots where farmer_id in(select id from public.farmers where registration_id=item);
  delete from public.registration_plots where registration_id=item;
  delete from private.person_identifiers where person_id=person;
  delete from private.registration_archives where registration_id=item;
  if g.status='completed' then
   update public.farmers set person_id=null,erased_at=now(),updated_at=now() where registration_id=item;
   update public.registrations set person_id=null,erased_at=now() where id=item;
  else
   delete from public.registrations where id=item;
  end if;
  delete from public.persons where id=person;
  insert into public.audit_events(actor_account_id,action,target_type,target_id,details)
   values(p_actor_id,'registration_permanently_deleted','registration',item::text,jsonb_build_object('financialHistoryRetained',true));
  changed:=changed+1;
 end loop;
 return jsonb_build_object('changed',changed);
end; $$;
revoke all on function public.purge_admin_registrations(uuid,uuid[],text) from public,anon,authenticated;
grant execute on function public.purge_admin_registrations(uuid,uuid[],text) to service_role;

-- Prevent the old Trash API from making an erased accounting record restorable.
create function private.reject_erased_archive() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.registrations where id=new.registration_id and erased_at is not null) then raise exception 'Selection changed'; end if;
 return new;
end; $$;
create trigger reject_erased_archive before insert or update on private.registration_archives
 for each row execute function private.reject_erased_archive();
revoke all on function private.reject_erased_archive() from public,anon,authenticated;
-- Operational totals exclude erased profiles; retained financial rows stay queryable.
create or replace function public.get_admin_workspace(p_actor_id uuid,p_section text default 'overview',p_query text default '',p_page integer default 1,p_status text default '',p_sort text default 'newest',p_from date default null,p_to date default null,p_size integer default 25)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; summary jsonb; items jsonb; total bigint; q text:=trim(p_query); off integer;
begin
 if not private.has_role(p_actor_id,array['manager','super_admin']) then raise exception 'Not authorized'; end if;
 if p_section is null or p_section not in ('overview','registrations','trash','staff','referrers','payouts','exceptions','grants','audit') or p_page is null or p_page<1 or p_page>10000 or p_size is null or p_size not in (25,50,100) or q is null or length(q)>100 or p_status is null or p_status not in ('','payment_pending','processing','completed','payment_exception') or p_sort is null or p_sort not in ('newest','oldest','name') or (p_from is not null and p_to is not null and p_from>p_to) then raise exception 'Invalid data' using errcode='23514'; end if;
 if p_section='trash' and not private.has_role(p_actor_id,array['super_admin']) then raise exception 'Not authorized'; end if;
 if p_section not in ('overview','registrations','trash') then return public.get_admin_page(p_actor_id,p_section,q,p_page); end if;
 select jsonb_build_object('total',count(*),'completed',count(*) filter(where status='completed'),'pending',count(*) filter(where status<>'completed'),'today',count(*) filter(where created_at>=(now() at time zone 'Asia/Kolkata')::date at time zone 'Asia/Kolkata'),'trash',(select count(*) from private.registration_archives)) into summary from public.registrations where erased_at is null;
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

commit;
