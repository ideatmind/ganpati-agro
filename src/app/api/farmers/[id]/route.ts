import {z} from "zod";
import {callRpc} from "@/server/database";
import {requireIdentity} from "@/server/session";
import {api,readJson} from "@/server/http";
import {enforceLimit} from "@/server/rate-limit";
import {profileChangesSchema} from "@/features/registration/profile-schema";
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){return api(request,async()=>{
  const actor=await requireIdentity(['employee','manager','super_admin']);await enforceLimit('edit:'+actor.id,30);
  const id=z.uuid().parse((await params).id);
  const changes=profileChangesSchema.parse(await readJson(request));
  return Response.json({data:await callRpc('update_farmer_profile',{p_actor_id:actor.id,p_farmer_id:id,p_changes:changes})});
});}
