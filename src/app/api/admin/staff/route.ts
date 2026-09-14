import {z} from "zod";
import {callRpc} from "@/server/database";
import {requireIdentity} from "@/server/session";
import {api,readJson} from "@/server/http";
import {enforceLimit} from "@/server/rate-limit";
import {passwordSchema,mobileSchema} from '@/shared/credential-schema';
const schema=z.object({name:z.string().trim().min(2).max(200),mobile:mobileSchema,password:passwordSchema,role:z.enum(['employee','manager'])});
export async function POST(request:Request){return api(request,async()=>{
  const actor=await requireIdentity(['super_admin']);await enforceLimit('staff:'+actor.id,5);
  const body=schema.parse(await readJson(request));
  return Response.json({data:await callRpc('create_staff_account',{p_actor_id:actor.id,p_name:body.name,p_mobile:body.mobile,p_password:body.password,p_role:body.role})},{status:201});
});}
export async function PATCH(request:Request){return api(request,async()=>{
 const actor=await requireIdentity(['super_admin']);await enforceLimit('staff-status:'+actor.id,20);
 const body=z.object({accountId:z.uuid(),status:z.enum(['active','disabled'])}).strict().parse(await readJson(request));
 return Response.json({data:await callRpc('set_staff_status',{p_actor_id:actor.id,p_account_id:body.accountId,p_status:body.status})});
});}
