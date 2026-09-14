begin;
-- Per-schema defaults cannot subtract the global default EXECUTE grant.
alter default privileges revoke execute on functions from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
commit;
