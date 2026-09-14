import "server-only";
import { cookies } from "next/headers";
import { createToken, readToken } from "@/server/signed-token";
import { AppError } from "@/shared/errors";

const COOKIE = "ga_checkout";
export async function setCheckout(id: string) {
  (await cookies()).set(COOKIE, createToken(id, "checkout", 7 * 86400), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 7 * 86400 });
}
export async function getCheckoutId() { return readToken((await cookies()).get(COOKIE)?.value, "checkout"); }
export async function requireCheckout(id?: string) {
  const current = await getCheckoutId();
  if (!current || (id && current !== id)) throw new AppError(403, "CHECKOUT_REQUIRED", "Reopen your registration to continue payment.");
  return current;
}
