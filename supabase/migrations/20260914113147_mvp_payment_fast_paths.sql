begin;
alter default privileges revoke execute on functions from public,anon,authenticated;
create function public.prepare_checkout(p_registration_id uuid,p_rate_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.consume_rate_limit(p_rate_key,10,60) then return jsonb_build_object('rateLimited',true); end if;
 return public.prepare_payment_order(p_registration_id);
end; $$;
create function public.get_limited_checkout(p_registration_id uuid,p_rate_key text,p_limit integer)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_limit not in (10,20,30) then raise exception 'Not authorized'; end if;
 if not public.consume_rate_limit(p_rate_key,p_limit,60) then return jsonb_build_object('rateLimited',true); end if;
 return public.get_checkout(p_registration_id);
end; $$;
create function public.authenticate_limited_session(p_mobile text,p_password text,p_session_id uuid,p_ip_key text,p_account_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.consume_rate_limit(p_ip_key,20,60) then return jsonb_build_object('rateLimited',true); end if;
 if not public.consume_rate_limit(p_account_key,5,60) then return jsonb_build_object('rateLimited',true); end if;
 return public.authenticate_account_session(p_mobile,p_password,p_session_id);
end; $$;
revoke execute on function public.prepare_checkout(uuid,text),public.get_limited_checkout(uuid,text,integer),public.authenticate_limited_session(text,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.prepare_checkout(uuid,text),public.get_limited_checkout(uuid,text,integer),public.authenticate_limited_session(text,text,uuid,text,text) to service_role;
commit;
