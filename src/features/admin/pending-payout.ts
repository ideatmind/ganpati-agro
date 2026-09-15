import {z} from 'zod';
import {rupeesToPaise} from '@/shared/money';
const amount=z.string().regex(/^\d{1,7}(\.\d{1,2})?$/).refine(value=>{try{rupeesToPaise(value);return true;}catch{return false;}},'Enter an amount from ₹0.01 to ₹1,000,000.');
export const pendingPayoutSchema=z.object({profileId:z.uuid(),idempotencyKey:z.uuid(),amountRupees:amount,method:z.enum(['cash','upi','bank_transfer','other']),reference:z.string().max(100),note:z.string().max(300),recipientLabel:z.string().max(500).optional()}).strict();
export type PendingPayout=z.infer<typeof pendingPayoutSchema>;
export function readPendingPayout(value:string|null):PendingPayout|null{
 if(!value)return null;
 return pendingPayoutSchema.parse(JSON.parse(value));
}
