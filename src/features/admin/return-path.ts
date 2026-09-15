import {adminQuery} from '@/features/admin/schema';
import {adminHref} from '@/features/admin/navigation';

// Return only to an allowlisted list with validated filters, never an arbitrary URL.
export function adminReturnPath(value:unknown,fallback:'registrations'|'trash'|'exceptions'='registrations',superAdmin=false){
 if(typeof value!=='string'||!value.startsWith('/dashboard/admin?'))return adminHref(fallback);
 const parsed=adminQuery.safeParse(Object.fromEntries(new URLSearchParams(value.split('?')[1])));
 if(!parsed.success||parsed.data.section==='trash'&&!superAdmin)return adminHref(fallback);
 if(!(fallback==='exceptions'?['exceptions']:['registrations','trash']).includes(parsed.data.section))return adminHref(fallback);
 const {section,...filters}=parsed.data;
 return adminHref(section,Object.fromEntries(Object.entries(filters).map(([key,val])=>[key,String(val)])));
}
