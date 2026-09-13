import { z } from "zod";
import { callRpc } from "@/server/database";
import { requireIdentity } from "@/server/session";

const schema = z.record(z.string(),z.string()).refine((value)=>Object.keys(value).length>0 && Object.keys(value).every((key)=>["name","date_of_birth","village","district","taluka","income_source","cluster_type"].includes(key)),"Invalid profile fields");

export async function PATCH(request: Request,{ params }:{ params:Promise<{ id:string }> }) {
  const actor = await requireIdentity(["employee","manager","super_admin"]);
  if (!actor) return Response.json({ error:"Not authorized" }, { status:403 });
  try {
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) throw new Error("Invalid farmer");
    const changes = schema.parse(await request.json());
    return Response.json({ data:await callRpc("update_farmer_profile", { p_actor_id:actor.id,p_farmer_id:id,p_changes:changes }) });
  } catch (error) { return Response.json({ error:error instanceof Error?error.message:"Farmer could not be updated" }, { status:400 }); }
}
