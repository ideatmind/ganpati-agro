import { z } from "zod";
import { callRpc } from "@/server/database";
import { requireIdentity } from "@/server/session";

const fields = ["name","date_of_birth","village","district","taluka","income_source","cluster_type"] as const;
const schema = z.object({ employeeId:z.uuid(), farmerId:z.uuid(), fields:z.array(z.enum(fields)).min(1), reason:z.string().trim().min(3).max(500), durationHours:z.coerce.number().int().min(1).max(168) });

export async function POST(request: Request) {
  const actor = await requireIdentity(["manager","super_admin"]);
  if (!actor) return Response.json({ error:"Not authorized" }, { status:403 });
  try {
    const body = schema.parse(await request.json());
    return Response.json({ data:await callRpc("grant_temporary_farmer_edit", { p_actor_id:actor.id,p_employee_id:body.employeeId,p_farmer_id:body.farmerId,p_allowed_fields:body.fields,p_reason:body.reason,p_expires_at:new Date(Date.now()+body.durationHours*3_600_000).toISOString() }) }, { status:201 });
  } catch (error) { return Response.json({ error:error instanceof Error?error.message:"Permission could not be granted" }, { status:400 }); }
}
