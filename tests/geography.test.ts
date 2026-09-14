import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DISTRICTS,TALUKAS,VILLAGE_PACKS,DIRECTORY_COUNTS} from '../src/features/geography/directory.ts';
import {parseVillagePack,searchVillages,villageValue} from '../src/features/geography/search.ts';
import {registrationSchema} from '../src/features/registration/schema.ts';

test('directory preserves every village and publishes only small versioned taluka packs',()=>{
 const codes=new Set<string>();assert.equal(DISTRICTS.length,5);assert.equal(TALUKAS.length,50);
 for(const [taluka,pack] of Object.entries(VILLAGE_PACKS)){
  assert.ok(TALUKAS.some(row=>row[0]===taluka));const bytes=readFileSync('public'+pack.path);assert.ok(bytes.length<13000);
  assert.ok(pack.path.includes(createHash('sha256').update(bytes).digest('hex').slice(0,16)));
  const rows=parseVillagePack(JSON.parse(bytes.toString()));assert.equal(rows.length,pack.count);
  for(const row of rows){assert.ok(!codes.has(row[0]),'Duplicate village code');codes.add(row[0]);}
 }
 assert.equal(codes.size,4875);assert.equal(DIRECTORY_COUNTS.reduce((sum,d)=>sum+d.villages,0),4875);
 assert.ok(TALUKAS.some(t=>t[0]==='umarga'&&t[2]==='Omarga'));assert.ok(TALUKAS.some(t=>t[0]==='parli_vaijnath'&&t[2]==='Parli'));
});
test('village search supports Marathi, English, codes, bounded results and duplicate-name disambiguation',()=>{
 const pack=parseVillagePack(JSON.parse(readFileSync('public'+VILLAGE_PACKS.barshi.path,'utf8')));
 assert.equal(searchVillages(pack,'').items.length,20);
 const sameName=searchVillages(pack,'malegaon').items;assert.equal(sameName.length,2);assert.notEqual(villageValue(sameName[0],pack),villageValue(sameName[1],pack));
 const village=pack[0];assert.ok(searchVillages(pack,village[2]).items.some(v=>v[0]===village[0]));assert.ok(searchVillages(pack,village[1].toUpperCase()).items.some(v=>v[0]===village[0]));assert.equal(searchVillages(pack,village[0]).items[0][0],village[0]);
 assert.equal(searchVillages(pack,'no-such-village').total,0);assert.throws(()=>parseVillagePack({villages:[]}));assert.throws(()=>parseVillagePack([['123','Name',null]]));
});
test('registration accepts all directory talukas and rejects mismatched districts',()=>{
 const base={name:'Geography Test',mobile:'8000000099',password:'test-only-password',aadhar_no:'123456789011',date_of_birth:'1990-01-01',village:'Test village',district:'latur',taluka:'latur',income_source:'agriculture',cluster_type:'pulses',consent:true,plots:[{plot_no:'Test-1',area_acres:1,crop_name:'तूर',irrigation_source:'well'}]};
 for(const [taluka,district] of TALUKAS)assert.equal(registrationSchema.safeParse({...base,taluka,district}).success,true,`${district}/${taluka}`);
 assert.equal(registrationSchema.safeParse({...base,district:'beed'}).success,false);
});

test('incremental browsing reaches every village without typing and keeps search results complete',()=>{
 for(const pack of Object.values(VILLAGE_PACKS)){
  const rows=parseVillagePack(JSON.parse(readFileSync('public'+pack.path,'utf8')));
  let previous:string[]=[];
  for(let limit=30;limit<rows.length+30;limit+=30){
   const result=searchVillages(rows,'',limit);const codes=result.items.map(row=>row[0]);
   assert.equal(result.total,rows.length);assert.equal(codes.length,Math.min(limit,rows.length));
   assert.deepEqual(codes.slice(0,previous.length),previous);assert.equal(new Set(codes).size,codes.length);previous=codes;
  }
  assert.deepEqual(previous,rows.map(row=>row[0]));
  const filtered=searchVillages(rows,'a',rows.length);assert.equal(filtered.items.length,filtered.total);
 }
});
