-- Run on an isolated migrated test database. All lookup updates are rolled back.
begin;
\i supabase/seeds/geography.sql
do $$
begin
 assert (select count(*) from public.districts where code in ('dharashiv','solapur','beed','sangli','latur'))=5;
 assert (select count(*) from public.talukas where district_code in ('dharashiv','solapur','beed','sangli','latur'))=50;
 assert exists(select 1 from public.talukas where code='umarga' and name_en='Omarga' and district_code='dharashiv');
 assert exists(select 1 from public.talukas where code='parli_vaijnath' and name_en='Parli' and district_code='beed');
 assert (select count(*) from public.talukas where district_code='latur')=10;
 assert not has_table_privilege('anon','public.talukas','insert');
end $$;
rollback;
