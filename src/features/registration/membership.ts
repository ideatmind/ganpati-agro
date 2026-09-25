import {z} from 'zod';
import {CROP_CATEGORIES} from '@/shared/crop-catalog';
export const MEMBERSHIP_TYPES = ['standard','focused_value_chain'] as const;
export type MembershipType = typeof MEMBERSHIP_TYPES[number];
export const membershipTypeSchema = z.enum(MEMBERSHIP_TYPES);
export const FOCUSED_CROPS = ['डाळिंब','आंबा','पेरू','पपई','कुक्कुटपालन','शेळी पालन'] as const;
export const MEMBERSHIP_LABELS:Record<MembershipType,string> = {
 standard:'Standard membership / नियमित सभासदत्व',
 focused_value_chain:'Focused Value Chain Membership / केंद्रित मूल्य साखळी सभासदत्व',
};
export function membershipPath(type:MembershipType){return type==='standard'?'/register':'/register/focused-value-chain';}
export function membershipCategories(type:MembershipType){
 return CROP_CATEGORIES.map(category=>({...category,crops:category.crops.filter(crop=>type==='standard'||FOCUSED_CROPS.some(value=>value===crop))})).filter(category=>category.crops.length);
}
export interface MembershipFormProfile {
 name:string;mobile:string;dateOfBirth:string;village:string;district:string;taluka:string;incomeSource:string;
}

export function registrationReturnPath(value?:string):string{
 if(!value)return '/dashboard';
 try{
  const url=new URL(value,'https://registration.invalid');
  if(url.origin!=='https://registration.invalid'||!['/register','/register/focused-value-chain'].includes(url.pathname))return '/dashboard';
  const ref=url.searchParams.get('ref')??'';
  return url.pathname+(/^[A-Za-z0-9]{6,16}$/.test(ref)?'?ref='+encodeURIComponent(ref):'');
 }catch{return '/dashboard';}
}
