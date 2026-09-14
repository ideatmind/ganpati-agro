import {z} from "zod";
import {callRpc} from "@/server/database";
import {requireIdentity} from "@/server/session";
import {api,readJson} from "@/server/http";
import {enforceLimit} from "@/server/rate-limit";
const fields=['name','date_of_birth','village','district','taluka','income_source','cluster_type'] as const;
const schema=z.object({employeeId:z.uuid(),farmerId:z.uuid(),fields:z.array(z.enum(fields)).min(1).max(7),reason:z.string().trim().min(3).max(500),durationHours:z.coerce.number().int().min(1).max(168)});
export async function POST(request:Request){return api(request,async()=>{
  const actor=await requireIdentity(['manager','super_admin']);await enforceLimit('grant:'+actor.id,20);
  const body=schema.parse(await readJson(request));
  return Response.json({data:await callRpc('grant_temporary_farmer_edit',{p_actor_id:actor.id,p_employee_id:body.employeeId,p_farmer_id:body.farmerId,p_allowed_fields:body.fields,p_reason:body.reason,p_expires_at:new Date(Date.now()+body.durationHours*3600000).toISOString()})},{status:201});
});}
export async function PATCH(request:Request){return api(request,async()=>{
 const actor=await requireIdentity(['manager','super_admin']);await enforceLimit('revoke-grant:'+actor.id,20);
 const body=z.object({grantId:z.uuid()}).strict().parse(await readJson(request));
 return Response.json({data:await callRpc('revoke_farmer_grant',{p_actor_id:actor.id,p_grant_id:body.grantId})});
});}
