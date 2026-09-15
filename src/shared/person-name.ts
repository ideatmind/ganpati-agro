import {z} from 'zod';
export const normalizePersonName=(value:string)=>value.normalize('NFC').trim().replace(/\s+/gu,' ');
export const personNameSchema=z.string().transform(normalizePersonName).pipe(z.string().min(2).max(200)
 .regex(/^[\p{L}\p{M}][\p{L}\p{M} .'’\-]*$/u,'Use letters, spaces, apostrophes, hyphens or initials.')
 .refine(value=>!/[.'’\-]{2}/u.test(value),'Avoid repeated punctuation in the name.'));
