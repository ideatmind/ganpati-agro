import {bulkActionSchema} from '@/features/admin/schema';
import {api,readJson} from '@/server/http';
import {requireIdentity} from '@/server/session';
import {callRpc} from '@/server/database';
import {enforceLimit} from '@/server/rate-limit';
import {AppError} from '@/shared/errors';
export async function POST(request:Request){return api(request,async()=>{
 const actor=await requireIdentity(['manager','super_admin']);const body=bulkActionSchema.parse(await readJson(request));
 if(body.action!=='revoke'&&!actor.roles.includes('super_admin'))throw new AppError(403,'FORBIDDEN','Super-admin access is required.');
 await enforceLimit('admin-bulk:'+actor.id,20);
 if(body.action==='trash'){
  if(body.allMatching||new Set(body.ids).size>25)await enforceLimit('admin-delete-password:'+actor.id,5);
  return Response.json({data:await callRpc('delete_admin_registrations',{p_actor_id:actor.id,p_ids:[...new Set(body.ids)],p_all:body.allMatching,p_query:body.filters?.q||'',p_status:body.filters?.status||'',p_from:body.filters?.from||null,p_to:body.filters?.to||null,p_expected:body.expectedCount??null,p_reason:body.reason,p_password:body.password??null})});
 }
 return Response.json({data:await callRpc('admin_bulk_action',{p_actor_id:actor.id,p_ids:[...new Set(body.ids)],p_action:body.action,p_reason:body.reason})});
});}
