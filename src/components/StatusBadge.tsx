const labels:Record<string,string>={payment_pending:'Payment pending',payment_exception:'Payment exception',bank_transfer:'Bank transfer',upi:'UPI',review:'Needs review',uncertain:'Unconfirmed',processing:'Processing',completed:'Completed',active:'Active',disabled:'Disabled',revoked:'Revoked',expired:'Expired',paid:'Paid',captured:'Captured',failed:'Failed',processed:'Processed',ignored:'Ignored',received:'Received',created:'Created',cash:'Cash',other:'Other'};
export function statusLabel(value:string){return labels[value]||value.replaceAll('_',' ').replace(/^./,letter=>letter.toUpperCase());}
export function StatusBadge({value}:{value:string}){
 const tone=['completed','active','processed','paid','captured'].includes(value)?'positive':['failed','payment_exception','disabled','revoked'].includes(value)?'negative':'neutral';
 return <span className={'admin-status '+tone}>{statusLabel(value)}</span>;
}
