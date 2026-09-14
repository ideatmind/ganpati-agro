import {z} from 'zod';
import {api,readJson} from '@/server/http';
import {requireIdentity} from '@/server/session';
import {enforceLimit} from '@/server/rate-limit';
import {revealAadhaar} from '@/features/admin/server/records';
export async function POST(request:Request){return api(request,async()=>{
 const actor=await requireIdentity(['super_admin']);await enforceLimit('aadhaar-view:'+actor.id,10);
 const body=z.object({registrationId:z.uuid()}).strict().parse(await readJson(request));
 return Response.json({data:{aadhaar:await revealAadhaar(actor,body.registrationId)}},{headers:{'Cache-Control':'private, no-store','Pragma':'no-cache','Referrer-Policy':'no-referrer'}});
});}
