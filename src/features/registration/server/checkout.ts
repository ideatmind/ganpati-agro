import "server-only";
import { cookies } from "next/headers";
import { createToken, readToken } from "@/server/signed-token";
import { AppError } from "@/shared/errors";
import { defaultPaymentMode, productionPayments, type PaymentMode } from '@/server/payment-mode';

import type {MembershipType} from '../membership';
export function checkoutCookie(type:MembershipType='standard'){return type==='standard'?'ga_checkout':'ga_focused_checkout';}
function purpose(type:MembershipType,mode:PaymentMode){return type==='standard'?'checkout:'+mode:'checkout:'+type+':'+mode;}
export async function setCheckout(id: string,mode:PaymentMode=defaultPaymentMode(),type:MembershipType="standard") {
  (await cookies()).set(checkoutCookie(type), createToken(id, purpose(type,mode), 7 * 86400), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 7 * 86400 });
}
export async function getCheckoutContext(type:MembershipType="standard") {
  const value=(await cookies()).get(checkoutCookie(type))?.value;
  for(const mode of ['test','live'] as const){if(productionPayments()&&mode==='test')continue;const id=readToken(value,purpose(type,mode));if(id)return {id,mode};}
  if(productionPayments())return null;
  const id=type==='standard'?readToken(value,'checkout'):null;
  return id?{id,mode:defaultPaymentMode()}:null;
}
export async function getCheckoutId(type:MembershipType="standard") { return (await getCheckoutContext(type))?.id??null; }
export async function getCheckoutMode(type:MembershipType="standard") { return (await getCheckoutContext(type))?.mode??defaultPaymentMode(); }
export async function requireCheckout(id?: string,type:MembershipType="standard") {
  const current = await getCheckoutId(type);
  if (!current || (id && current !== id)) throw new AppError(403, "CHECKOUT_REQUIRED", "Reopen your registration to continue payment.");
  return current;
}
