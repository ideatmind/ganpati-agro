import { z } from "zod";
import { callRpc } from "@/server/database";
import { requireIdentity } from "@/server/session";

const schema = z.object({ profileId:z.uuid(), amountRupees:z.coerce.number().positive().max(1_000_000), method:z.enum(["cash","upi","bank_transfer","other"]), reference:z.string().trim().max(100).default(""), note:z.string().trim().max(300).default("") });

export async function POST(request: Request) {
  const actor = await requireIdentity(["manager","super_admin"]);
  if (!actor) return Response.json({ error:"Not authorized" }, { status:403 });
  try {
    const body = schema.parse(await request.json());
    return Response.json({ data:await callRpc("record_offline_payout", { p_actor_id:actor.id,p_referrer_profile_id:body.profileId,p_amount_paise:Math.round(body.amountRupees*100),p_method:body.method,p_reference:body.reference,p_note:body.note,p_paid_at:new Date().toISOString() }) }, { status:201 });
  } catch (error) { return Response.json({ error:error instanceof Error?error.message:"Payout could not be recorded" }, { status:400 }); }
}
