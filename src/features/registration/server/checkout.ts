import "server-only";
import { cookies } from "next/headers";
import { createToken, readToken } from "@/server/signed-token";
import { AppError } from "@/shared/errors";
import { defaultPaymentMode, type PaymentMode } from '@/server/payment-mode';

const COOKIE = "ga_checkout";
export async function setCheckout(id: string,mode:PaymentMode=defaultPaymentMode()) {
  (await cookies()).set(COOKIE, createToken(id, `checkout:${mode}`, 7 * 86400), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 7 * 86400 });
}
export async function getCheckoutContext() {
  const value=(await cookies()).get(COOKIE)?.value;
  for(const mode of ['test','live'] as const){const id=readToken(value,`checkout:${mode}`);if(id)return {id,mode};}
  const id=readToken(value,'checkout');
  return id?{id,mode:defaultPaymentMode()}:null;
}
export async function getCheckoutId() { return (await getCheckoutContext())?.id??null; }
export async function getCheckoutMode() { return (await getCheckoutContext())?.mode??defaultPaymentMode(); }
export async function requireCheckout(id?: string) {
  const current = await getCheckoutId();
  if (!current || (id && current !== id)) throw new AppError(403, "CHECKOUT_REQUIRED", "Reopen your registration to continue payment.");
  return current;
}
