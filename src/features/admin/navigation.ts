export const adminNavigation=[
 {id:'overview',label:'Overview',description:'A clear view of registrations and the work that needs attention.',icon:'overview'},
 {id:'registrations',label:'Registrations',description:'Find a farmer, review submitted details and manage records.',icon:'people'},
 {id:'staff',label:'Team & access',description:'Manage employee and manager accounts.',icon:'team'},
 {id:'referrers',label:'Referral balances',description:'Review earnings, completed payouts and available balances.',icon:'wallet'},
 {id:'payouts',label:'Payout history',description:'Record and review money already paid offline.',icon:'receipt'},
 {id:'grants',label:'Edit permissions',description:'Manage temporary access to specific farmer records.',icon:'key'},
 {id:'exceptions',label:'Payment exceptions',description:'Investigate provider events and uncertain checkout states.',icon:'alert'},
 {id:'audit',label:'Activity log',description:'A permanent record of administrative actions.',icon:'activity'},
 {id:'trash',label:'Trash',description:'Restore removed registrations. Payment and membership history is retained.',icon:'trash'},
] as const;
export function adminHref(section:string,values:Record<string,string>={}){return '/dashboard/admin?'+new URLSearchParams({section,...values});}
