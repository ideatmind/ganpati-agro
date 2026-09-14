import type {AdminRow} from './schema';
function cell(value:unknown){let text=String(value??'');if(/^[\s]*[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
export function adminRowsCsv(rows:AdminRow[]){
 const columns=['Name','Reference','Mobile','Village','District','Status','Amount INR','Created','Attributed to'];
 return '\uFEFF'+[columns,...rows.map(row=>[row.label,row.reference,row.mobile,row.village,row.district,row.status,row.amountPaise===undefined?'':(row.amountPaise/100).toFixed(2),row.createdAt,row.actor])].map(row=>row.map(cell).join(',')).join('\r\n');
}
