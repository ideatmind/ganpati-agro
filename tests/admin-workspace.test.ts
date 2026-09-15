import test from 'node:test';
import assert from 'node:assert/strict';
import {protectAadhaar,decryptAadhaar} from '../src/server/pii.ts';
import {bulkActionSchema,adminQuery} from '../src/features/admin/schema.ts';
import {adminRowsCsv} from '../src/features/admin/csv.ts';
import {revealAadhaar} from '../src/features/admin/server/records.ts';
import {passwordSchema,mobileSchema,aadhaarSchema} from '../src/shared/credential-schema.ts';
import {permanentlyDeleteRegistrations} from '../src/features/admin/server/permanent-delete.ts';

test('permanent deletion requires explicit bounded selection, password and super-admin access',async()=>{
 const input={ids:[crypto.randomUUID()],action:'purge',password:'test-password'};
 assert.equal(bulkActionSchema.safeParse(input).success,true);
 for(const change of [{password:undefined},{password:''},{ids:[]},{ids:Array(101).fill(input.ids[0])},{allMatching:true,filters:{},expectedCount:10},{actorId:crypto.randomUUID()}])assert.equal(bulkActionSchema.safeParse({...input,...change}).success,false);
 for(const roles of [['manager'],['employee'],['farmer_referrer']] as const){
  await assert.rejects(()=>permanentlyDeleteRegistrations({id:crypto.randomUUID(),mobile:'8000000001',displayName:'Denied',roles:[...roles]},input),{code:'FORBIDDEN'});
 }
});

test('passwords require eight characters and identifiers require exact ASCII digit counts',()=>{
 assert.equal(passwordSchema.safeParse('12345678').success,true);assert.equal(passwordSchema.safeParse('1234567').success,false);assert.equal(passwordSchema.safeParse('क'.repeat(25)).success,false);
 for(const [schema,valid] of [[mobileSchema,'0123456789'],[aadhaarSchema,'012345678901']] as const){
  assert.equal(schema.safeParse(valid).success,true);
  for(const invalid of [valid.slice(1),valid+'0',valid+'\n',' '+valid,valid+' ',valid.slice(0,-1)+'a','+'+valid,1234567890,'१२३४५६७८९०'])assert.equal(schema.safeParse(invalid).success,false);
 }
 const all={ids:[],action:'trash',allMatching:true,expectedCount:50000,filters:{},reason:'Synthetic cleanup',password:'12345678'};
 assert.equal(bulkActionSchema.safeParse(all).success,true);
 for(const change of [{action:'restore'},{ids:[crypto.randomUUID()]},{expectedCount:0},{filters:{actorId:crypto.randomUUID()}}])assert.equal(bulkActionSchema.safeParse({...all,...change}).success,false);
});
test('Aadhaar decrypts authenticated ciphertext and rejects tampering',()=>{
 process.env.PII_ENCRYPTION_KEY='1'.repeat(64);
 const encrypted=protectAadhaar('123456789012');assert.equal(decryptAadhaar(encrypted.ciphertext),'123456789012');
 const parts=encrypted.ciphertext.split('.');const changed=Buffer.from(parts[2],'base64url');changed[0]^=1;parts[2]=changed.toString('base64url');
 assert.throws(()=>decryptAadhaar(parts.join('.')));assert.throws(()=>decryptAadhaar('synthetic-test-only'));assert.throws(()=>decryptAadhaar(encrypted.ciphertext+'.extra'));
});
test('ordinary roles cannot reach the Aadhaar read boundary',async()=>{
 await assert.rejects(()=>revealAadhaar({id:crypto.randomUUID(),mobile:'8000000001',displayName:'Manager',roles:['manager']},crypto.randomUUID()),{code:'FORBIDDEN'});
});
test('bulk and filter inputs reject overposting, unbounded batches and invalid ranges',()=>{
 const id=crypto.randomUUID();assert.equal(bulkActionSchema.safeParse({ids:[id],action:'trash',reason:'Duplicate record'}).success,true);
 for(const input of [{ids:[],action:'trash',reason:'Test'},{ids:Array(101).fill(id),action:'restore'},{ids:[id],action:'trash',reason:''},{ids:[id],action:'restore',actorId:id},{ids:[id],action:'delete'}])assert.equal(bulkActionSchema.safeParse(input).success,false);
 assert.equal(adminQuery.safeParse({from:'2026-09-20',to:'2026-09-01'}).success,false);assert.equal(adminQuery.safeParse({size:10000}).success,false);
});
test('CSV export escapes formulas and limits fields to the operational allowlist',()=>{
 const csv=adminRowsCsv([{id:'secret-internal-id',label:'=IMPORTXML("url")',reference:'a,b',mobile:'9999999999',amountPaise:50001}]);
 assert.ok(csv.includes("'=IMPORTXML"));assert.ok(csv.includes('"a,b"'));assert.ok(csv.includes('500.01'));assert.ok(!csv.includes('secret-internal-id'));assert.ok(!/aadhaar|ciphertext|password/i.test(csv));
});
