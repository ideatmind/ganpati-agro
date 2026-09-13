import { z } from "zod";
import { callRpc } from "@/server/database";
import { requireIdentity } from "@/server/session";

const schema = z.object({ name:z.string().trim().min(2).max(200), mobile:z.string().regex(/^\d{10}$/), password:z.string().min(8).max(128), role:z.enum(["employee","manager"]) });

export async function POST(request: Request) {
  const actor = await requireIdentity(["super_admin"]);
  if (!actor) return Response.json({ error:"Not authorized" }, { status:403 });
  try {
    const body = schema.parse(await request.json());
    return Response.json({ data:await callRpc("create_staff_account", { p_actor_id:actor.id,p_name:body.name,p_mobile:body.mobile,p_password:body.password,p_role:body.role }) }, { status:201 });
  } catch (error) { return Response.json({ error:error instanceof Error?error.message:"Staff account could not be created" }, { status:400 }); }
}
