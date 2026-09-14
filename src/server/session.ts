import "server-only";
import { randomUUID } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { callRpc } from "@/server/database";
import { createToken, readToken } from "@/server/signed-token";
import { AppError } from "@/shared/errors";
import { rateLimitKey } from "@/server/rate-limit";
export type Role = "farmer_referrer" | "employee" | "manager" | "super_admin";
export interface Identity { id: string; mobile: string; displayName: string; roles: Role[] }
const COOKIE='ga_session';
export async function loginSession(mobile: string,password: string,ip:string) {
  const id=randomUUID();
  const identity=await callRpc<Identity|null>('authenticate_limited_session',{p_mobile:mobile,p_password:password,p_session_id:id,p_ip_key:rateLimitKey('login-ip:'+ip),p_account_key:rateLimitKey('login-account:'+mobile)});
  if(!identity)return null;
  (await cookies()).set(COOKIE,createToken(id,'session',43200),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:43200,path:'/'});
  return identity;
}
export async function clearSession({revoke=true}:{revoke?:boolean}={}) {
  const jar=await cookies();
  const id=readToken(jar.get(COOKIE)?.value,'session');
  if(id&&revoke) await callRpc('revoke_account_session',{p_session_id:id});
  jar.delete(COOKIE);
  jar.delete('ga_checkout');
}
export const getIdentity = cache(async (): Promise<Identity|null> => {
  const id=readToken((await cookies()).get(COOKIE)?.value,'session');
  return id ? callRpc<Identity|null>('resolve_account_session',{p_session_id:id}) : null;
});
export async function requireIdentity(roles?: Role[]) {
  const identity=await getIdentity();
  if(!identity) throw new AppError(401,'UNAUTHENTICATED','Please sign in to continue.');
  if(roles&&!roles.some(role=>identity.roles.includes(role))) throw new AppError(403,'FORBIDDEN','You do not have permission for this action.');
  return identity;
}
