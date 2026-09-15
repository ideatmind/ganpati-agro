import 'server-only';
import {bulkActionSchema} from '@/features/admin/schema';
import {callRpc} from '@/server/database';
import {enforceLimit} from '@/server/rate-limit';
import type {Identity} from '@/server/session';
import {AppError} from '@/shared/errors';

export async function permanentlyDeleteRegistrations(actor:Identity,input:unknown){
 if(!actor.roles.includes('super_admin'))throw new AppError(403,'FORBIDDEN','Super-admin access is required.');
 const body=bulkActionSchema.parse(input);
 if(body.action!=='purge')throw new AppError(400,'INVALID_DATA','Choose permanent deletion.');
 await enforceLimit('admin-delete-password:'+actor.id,5);
 return callRpc<{changed:number}>('purge_admin_registrations',{p_actor_id:actor.id,p_ids:[...new Set(body.ids)],p_password:body.password});
}
