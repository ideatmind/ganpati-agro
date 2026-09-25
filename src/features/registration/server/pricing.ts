import 'server-only';
import {z} from 'zod';
import {callRpc} from '@/server/database';
import type {MembershipType} from '../membership';
export async function registrationFee(type:MembershipType='standard'){
 return z.number().int().positive().max(2_147_483_647).parse(await callRpc('get_membership_fee',{p_membership_type:type}));
}
