import {z} from 'zod';
export const passwordSchema=z.string().min(8,'Use at least 8 characters.').max(72).refine(value=>new TextEncoder().encode(value).length<=72,'Password must be at most 72 UTF-8 bytes.');
export const mobileSchema=z.string().length(10,'Mobile number must be exactly 10 digits.').regex(/^[0-9]+$/,'Use digits only.');
export const aadhaarSchema=z.string().length(12,'Aadhaar must be exactly 12 digits.').regex(/^[0-9]+$/,'Use digits only.');
