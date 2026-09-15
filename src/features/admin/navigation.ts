export const adminNavigation=[
 {id:'overview',label:'Overview',description:'A clear view of registrations and the work that needs attention.',icon:'overview'},
 {id:'registrations',label:'Registrations',description:'Find a farmer, review submitted details and manage records.',icon:'people'},
 {id:'staff',label:'Team & access',description:'Manage employee and manager accounts.',icon:'team'},
 {id:'referrers',label:'Referral balances',description:'Review earnings, completed payouts and available balances.',icon:'wallet'},
 {id:'payouts',label:'Payout history',description:'Record and review money already paid offline.',icon:'receipt'},
 {id:'grants',label:'Edit permissions',description:'Manage temporary access to specific farmer records.',icon:'key'},
 {id:'exceptions',label:'Payment exceptions',description:'Investigate provider events and uncertain checkout states.',icon:'alert'},
 {id:'audit',label:'Activity log',description:'A permanent record of administrative actions.',icon:'activity'},
 {id:'trash',label:'Trash',description:'Restore registrations or permanently delete personal data. Financial history is retained.',icon:'trash'},
] as const;
export function adminHref(section:string,values:Record<string,string>={}){return '/dashboard/admin?'+new URLSearchParams({section,...values});}

export function navigationFor(roles:readonly string[]){
 if(!roles.some(role=>role==='manager'||role==='super_admin'))return [];
 const superAdmin=roles.includes('super_admin');
 return adminNavigation.filter(item=>superAdmin||item.id!=='trash').map(item=>({...item,
  ...(item.id==='staff'&&!superAdmin?{label:'Team activity',description:'Review staff access and onboarding counts. Account changes are restricted to super administrators.'}:{}),
  group:['overview','registrations','exceptions'].includes(item.id)?'Operations':['referrers','payouts'].includes(item.id)?'Referrals':item.id==='staff'?'Team':'Administration',
 }));
}

export function activeAdminSection(pathname:string,section:string|null){
 if(pathname.endsWith('/account'))return 'account';
 if(pathname.includes('/registrations/'))return 'registrations';
 if(pathname.includes('/payments/'))return 'exceptions';
 if(pathname.includes('/new/'))return ({staff:'staff',payout:'payouts',grant:'grants'} as Record<string,string>)[pathname.split('/').pop()!]||'overview';
 return section||'overview';
}

export const adminListCopy:Record<string,{search:string;empty:string;hint:string}>={
 overview:{search:'',empty:'No registrations yet',hint:'New farmer registrations will appear here.'},
 registrations:{search:'Name, registration reference or full mobile',empty:'No matching registrations',hint:'Clear filters or try a name, registration reference or full mobile number.'},
 trash:{search:'Name, registration reference or full mobile',empty:'No matching records in Trash',hint:'Only records moved to Trash can be restored or permanently deleted here.'},
 staff:{search:'Staff name or full mobile',empty:'No matching team members',hint:'Search by staff name or full mobile. New staff accounts appear here after creation.'},
 referrers:{search:'Name, referral code or full mobile',empty:'No matching referrers',hint:'Search by name, referral code or full mobile number.'},
 payouts:{search:'Recipient name or payment reference',empty:'No matching payout records',hint:'Completed offline disbursements appear here once recorded.'},
 grants:{search:'Farmer name, employee name or registration reference',empty:'No matching edit permissions',hint:'Temporary permissions appear here after management grants access.'},
 exceptions:{search:'Event type or event/registration reference',empty:'No matching payment exceptions',hint:'No exceptions match this view. Check registrations for other pending checkouts.'},
 audit:{search:'Action name',empty:'No matching activity',hint:'Try another action name or clear the search.'},
};
