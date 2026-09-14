import {z} from "zod";
import {callRpc} from "@/server/database";
import {requireIdentity} from "@/server/session";
import {api,readJson} from "@/server/http";
import {enforceLimit} from "@/server/rate-limit";
import {rupeesToPaise} from "@/shared/money";
import {AppError} from "@/shared/errors";
const schema=z.object({profileId:z.uuid(),idempotencyKey:z.uuid(),amountRupees:z.string().regex(/^\d{1,7}(\.\d{1,2})?$/),method:z.enum(['cash','upi','bank_transfer','other']),reference:z.string().trim().max(100).default(''),note:z.string().trim().max(300).default('')});
export async function POST(request:Request){return api(request,async()=>{
  const actor=await requireIdentity(['manager','super_admin']);
  await enforceLimit('payout:'+actor.id,10);
  const body=schema.parse(await readJson(request));
  let amount:number;
  try { amount=rupeesToPaise(body.amountRupees); }
  catch { throw new AppError(400,'INVALID_AMOUNT','Use an amount from ₹0.01 to ₹1,000,000 with at most two decimal places.'); }
  return Response.json({data:await callRpc('record_offline_payout',{p_actor_id:actor.id,p_referrer_profile_id:body.profileId,p_amount_paise:amount,p_method:body.method,p_reference:body.reference,p_note:body.note,p_paid_at:new Date().toISOString(),p_idempotency_key:body.idempotencyKey})},{status:201});
});}
