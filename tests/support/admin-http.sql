-- Synthetic account for isolated HTTP authorization tests only.
insert into public.accounts(id,mobile,password_hash,display_name,status)
values('20000000-0000-4000-8000-000000000001','6999999998',extensions.crypt('isolated admin password',extensions.gen_salt('bf',12)),'HTTP test admin','active') on conflict do nothing;
insert into public.account_roles(account_id,role) values('20000000-0000-4000-8000-000000000001','super_admin') on conflict do nothing;
