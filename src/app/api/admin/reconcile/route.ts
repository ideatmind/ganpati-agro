import {z} from 'zod';
import {api,readJson} from '@/server/http';
import {requireIdentity} from '@/server/session';
import {callRpc} from '@/server/database';
import {reconcileCheckout} from '@/features/payments/server/payments';
import {AppError} from '@/shared/errors';
import {enforceLimit} from '@/server/rate-limit';
import type {RegistrationDetail} from '@/features/admin/schema';
export async function POST(request:Request){return api(request,async()=>{
 const actor=await requireIdentity(['manager','super_admin']);
 const body=z.object({registrationId:z.uuid()}).strict().parse(await readJson(request));
 await enforceLimit('admin-reconcile:'+actor.id,20);
 const detail=await callRpc<RegistrationDetail|null>('get_admin_registration',{p_actor_id:actor.id,p_registration_id:body.registrationId});
 if(!detail)throw new AppError(404,'NOT_FOUND','Registration not found.');
 if(!detail.orders.length)throw new AppError(409,'ORDER_UNCERTAIN','No provider order is bound. Find the registration reference in Razorpay before considering any replacement.');
 return Response.json({data:await reconcileCheckout(body.registrationId,true)});
});}
