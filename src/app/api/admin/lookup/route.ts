import {z} from 'zod';
import {api} from '@/server/http';
import {requireIdentity} from '@/server/session';
import {callRpc} from '@/server/database';
import {enforceLimit} from '@/server/rate-limit';
export async function GET(request:Request){return api(request,async()=>{
 const actor=await requireIdentity(['manager','super_admin']);
 const query=z.object({kind:z.enum(['employee','farmer','referrer']),q:z.string().trim().min(2).max(100),employeeId:z.uuid().optional()}).parse(Object.fromEntries(new URL(request.url).searchParams));
 await enforceLimit('admin-lookup:'+actor.id,60);
 return Response.json({data:await callRpc('search_admin_options',{p_actor_id:actor.id,p_kind:query.kind,p_query:query.q,p_employee_id:query.employeeId??null})});
});}
