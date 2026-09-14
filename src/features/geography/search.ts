export type Village = [code:string,en:string,mr:string];
const normalize=(value:string)=>value.normalize('NFKC').toLowerCase().trim();
export function parseVillagePack(value:unknown):Village[]{
 if(!Array.isArray(value)||value.length>300||!value.every(row=>Array.isArray(row)&&row.length===3&&row.every(cell=>typeof cell==='string'&&cell.length>0&&cell.length<=200)&&/^[0-9]+$/.test(row[0])))throw Error('Village directory is unavailable.');
 return value as Village[];
}
export function searchVillages(rows:Village[],query:string,limit=20){
 const q=normalize(query);const starts:Village[]=[];const contains:Village[]=[];
 for(const row of rows){const en=normalize(row[1]);const mr=normalize(row[2]);if(en.startsWith(q)||mr.startsWith(q)||row[0].startsWith(q))starts.push(row);else if(en.includes(q)||mr.includes(q))contains.push(row);}
 return {items:[...starts,...contains].slice(0,limit),total:starts.length+contains.length};
}
export function villageValue(row:Village,rows:Village[]){
 return rows.some(other=>other[0]!==row[0]&&other[1]===row[1])?`${row[1]} (${row[0]})`:row[1];
}
