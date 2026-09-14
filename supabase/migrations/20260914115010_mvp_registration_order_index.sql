-- EXPLAIN at 10k rows showed a full join and top-N sort for the first admin page.
-- This ordering lets Postgres stop after the requested page, using existing join PKs.
create index registrations_created_id_idx on public.registrations(created_at desc,id desc);
