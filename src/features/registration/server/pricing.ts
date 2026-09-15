import 'server-only';
import {z} from 'zod';
import {callRpc} from '@/server/database';
export async function registrationFee(){
 return z.number().int().positive().max(2_147_483_647).parse(await callRpc('get_registration_fee',{}));
}
