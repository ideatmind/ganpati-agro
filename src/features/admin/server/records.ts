import 'server-only';
import {callRpc} from '@/server/database';
import {decryptAadhaar} from '@/server/pii';
import {AppError} from '@/shared/errors';
import type {Identity} from '@/server/session';
export async function revealAadhaar(actor:Identity,registrationId:string){
 if(!actor.roles.includes('super_admin'))throw new AppError(403,'FORBIDDEN','Super-admin access is required.');
 const ciphertext=await callRpc<string|null>('read_admin_aadhaar',{p_actor_id:actor.id,p_registration_id:registrationId});
 if(!ciphertext)throw new AppError(404,'NOT_FOUND','No Aadhaar is stored for this record.');
 try{return decryptAadhaar(ciphertext);}catch{throw new AppError(503,'IDENTIFIER_UNAVAILABLE','This protected identifier could not be opened. Check the encryption-key configuration.');}
}
