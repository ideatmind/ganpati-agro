import { z } from "zod";
import { api, readJson } from "@/server/http";
import { requireIdentity, clearSession } from "@/server/session";
import { callRpc } from "@/server/database";
import { enforceLimit } from "@/server/rate-limit";
import {passwordSchema} from '@/shared/credential-schema';
import {AppError} from '@/shared/errors';
const schema = z.object({ currentPassword:z.string().min(8).max(72),newPassword:passwordSchema });
export async function POST(request:Request){return api(request,async()=>{
  const actor=await requireIdentity(); await enforceLimit(`password:${actor.id}`,5);
  const body=schema.parse(await readJson(request));
  try{await callRpc('change_account_password',{p_account_id:actor.id,p_current_password:body.currentPassword,p_new_password:body.newPassword});}
  catch(error){if(error instanceof AppError&&error.code==='FORBIDDEN')throw new AppError(403,'INVALID_CURRENT_PASSWORD','Your current password is incorrect.');throw error;}
  // The password transaction already revoked every session; only clear browser cookies here.
  await clearSession({revoke:false});
  return Response.json({data:{ok:true}});
});}
