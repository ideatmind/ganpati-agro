import "server-only";
import { requiredEnv } from "@/server/env";
import { AppError } from "@/shared/errors";
import { timed } from "@/server/timing";

export async function callRpc<T>(name: string, params: Record<string, unknown>): Promise<T> {
  return timed('db.'+name,()=>executeRpc<T>(name,params));
}
async function executeRpc<T>(name:string,params:Record<string,unknown>):Promise<T>{
  const url = requiredEnv("SUPABASE_URL");
  const key = requiredEnv("SUPABASE_SECRET_KEY");
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json", "User-Agent": "GanpatiAgroServer/1.0" },
    body: JSON.stringify(params),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { code?: string; message?: string };
    const safe = new Map<string, readonly [number,string,string]>([
      ["Rate limited", [429,"RATE_LIMITED","Too many attempts. Please wait a minute."]],
      ["Password confirmation required", [403,"PASSWORD_REQUIRED","Enter your super-admin password to delete this selection."]],
      ["Incorrect confirmation password", [403,"INVALID_PASSWORD","The confirmation password is incorrect."]],
      ["Selection changed", [409,"SELECTION_CHANGED","The matching records changed. Refresh the list and select again."]],
      ["Registration fee changed", [409,"FEE_CHANGED","The registration fee changed. Refresh the form and review the new amount before continuing."]],
      ["Only trashed registrations can be permanently deleted", [409,"NOT_IN_TRASH","Move every selected record to Trash before permanently deleting it."]],
      ["Unresolved checkout prevents permanent deletion", [409,"CHECKOUT_UNRESOLVED","A selected record has an unresolved checkout or cash collection. Complete or reconcile it before permanent deletion."]],
      ["Staff accounts cannot be permanently deleted", [409,"STAFF_ACCOUNT","A selected farmer also has staff access. Staff accounts cannot be permanently deleted here."]],
      ["A valid mobile number and password of at least 8 characters are required", [400,"INVALID_PASSWORD","Use a password of at least 8 characters."]],
      ["Not authorized", [403, "FORBIDDEN", "You do not have permission for this action."]],
      ["One or more fields are not authorized", [403, "FORBIDDEN", "Edit permission is missing or expired."]],
      ["Payout exceeds available earnings", [409, "INSUFFICIENT_BALANCE", "Payout exceeds available earnings."]],
      ["Invalid referral code", [400, "INVALID_REFERRAL", "Referral code is not valid."]],
      ["An account already exists for this mobile number", [409, "REGISTRATION_CONFLICT", "A registration already exists. Sign in or contact support to resume."]],
      ["An account already exists for this Aadhaar number", [409, "REGISTRATION_CONFLICT", "A registration already exists. Sign in or contact support to resume."]],
      ["Idempotency key reused with different payout", [409, "IDEMPOTENCY_CONFLICT", "This payout request was already used. Check the recorded payout."]],
    ] as const);
    const mapped = safe.get(body.message || "");
    if (mapped) throw new AppError(mapped[0], mapped[1], mapped[2]);
    if (body.code === "23505") throw new AppError(409, "CONFLICT", "A matching record already exists. Check its status before retrying.");
    if (["23514", "23503", "22007", "22P02"].includes(body.code || "")) throw new AppError(400, "INVALID_DATA", "Please check the submitted fields.");
    throw new AppError(503, "DATABASE_UNAVAILABLE", "Service is temporarily unavailable. Please try again.");
  }
  if(response.status===204)return undefined as T;
  const result=await response.json();
  if(result?.rateLimited===true)throw new AppError(429,'RATE_LIMITED','Too many attempts. Please wait a minute.');
  return result as T;
}
