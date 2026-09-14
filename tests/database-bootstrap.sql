-- Isolated vanilla Postgres only; never run this bootstrap on Supabase.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema extensions;
create extension pgcrypto with schema extensions;
