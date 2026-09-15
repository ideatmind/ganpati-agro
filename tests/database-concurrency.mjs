import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const database=process.env.TEST_DATABASE_URL;
if(!database||!['localhost','127.0.0.1','[::1]'].includes(new URL(database).hostname))throw Error('Set a loopback TEST_DATABASE_URL for isolated concurrency fixtures.');
const sqlLiteral=value=>"'"+String(value).replaceAll("'","''")+"'";
async function sql(query){return new Promise((resolve,reject)=>{
  const child=spawn(process.env.PSQL_PATH||'psql',['-X','-A','-t','-v','ON_ERROR_STOP=1','--dbname',database],{windowsHide:true});let result='';let error='';
  child.stdout.on('data',value=>result+=value);child.stderr.on('data',value=>error+=value);child.on('error',reject);
  child.on('exit',code=>code?reject(Error(error)):resolve(result.trim()));child.stdin.end(query);
});}
const suffix=String(Date.now()).slice(-8);
const payload={name:'Concurrency Fixture',mobile:'71'+suffix,password:'isolated concurrency password',date_of_birth:'1990-01-01',village:'Fixture village',district:'dharashiv',taluka:'dharashiv',income_source:'agriculture',cluster_type:'pulses',aadhar_fingerprint:crypto.randomUUID().replaceAll('-','').repeat(2),aadhar_ciphertext:'synthetic',aadhar_last_four:'0000',consent:true,plots:[{plot_no:'Fixture',area_acres:1,crop_name:'Fixture',irrigation_source:'well'}]};
const registration=JSON.parse(await sql('select public.create_registration('+sqlLiteral(JSON.stringify(payload))+'::jsonb);'));
const id=sqlLiteral(registration.id);
const reservations=await Promise.all(Array.from({length:12},()=>sql('select public.prepare_payment_order('+id+'::uuid);').then(JSON.parse)));
assert.equal(reservations.filter(result=>result.requestKey).length,1,'More than one provider creation allowed');
const key=reservations.find(result=>result.requestKey).requestKey;
const order='order_concurrency_'+suffix;const payment='pay_concurrency_'+suffix;
await sql(`select public.record_payment_order(${id},${sqlLiteral(order)},${sqlLiteral(key)});`);
const completed=await Promise.all(Array.from({length:12},(_,index)=>sql(index%2===0?
  `select public.finalize_registration_payment(${sqlLiteral(order)},${sqlLiteral(payment)},${registration.amountPaise},'INR','farmer',true);`:
  `select public.record_payment_event('event_concurrent_${suffix}_${index}','payment.captured',${sqlLiteral(order)},${sqlLiteral(payment)},${registration.amountPaise},'INR','{}');`).then(JSON.parse)));
assert.equal(new Set(completed.map(result=>result.receiptToken)).size,1,'Capture race returned inconsistent receipts');
const count=JSON.parse(await sql(`select jsonb_build_object('farmers',(select count(*) from public.farmers where registration_id=${id}),'memberships',(select count(*) from public.memberships where registration_id=${id}),'receipts',(select count(*) from public.receipts where registration_id=${id}),'attempts',(select count(*) from public.payment_attempts where provider_payment_id=${sqlLiteral(payment)}));`));
assert.deepEqual(count,{farmers:1,memberships:1,receipts:1,attempts:1});
console.log('PASS: 12 concurrent order reservations and 12 simultaneous browser/webhook captures produce one order reservation, farmer, membership, receipt and capture.');

const admin=crypto.randomUUID();
await sql(`insert into public.accounts(id,mobile,password_hash,display_name,status) values(${sqlLiteral(admin)},${sqlLiteral('72'+suffix)},extensions.crypt('purge-test-password',extensions.gen_salt('bf',4)),'Purge concurrency admin','active');
insert into public.account_roles(account_id,role) values(${sqlLiteral(admin)},'super_admin');
select public.admin_bulk_action(${sqlLiteral(admin)},array[${id}::uuid],'trash','Concurrent purge test');`);
const erased=await Promise.all(Array.from({length:12},(_,index)=>sql(index%2===0?
  `select public.purge_admin_registrations(${sqlLiteral(admin)},array[${id}::uuid],'purge-test-password');`:
  `select public.record_payment_event('event_purge_race_${suffix}_${index}','payment.captured',${sqlLiteral(order)},${sqlLiteral(payment)},${registration.amountPaise},'INR','{}');`).then(JSON.parse)));
assert.equal(erased.reduce((total,result)=>total+(result.changed??0),0),1);
assert.ok(erased.every(result=>!result.failed));
const retained=JSON.parse(await sql(`select jsonb_build_object('persons',(select count(*) from public.persons where mobile=${sqlLiteral(payload.mobile)}),'receipts',(select count(*) from public.receipts where registration_id=${id}),'memberships',(select count(*) from public.memberships where registration_id=${id}),'audits',(select count(*) from public.audit_events where action='registration_permanently_deleted' and target_id=${id}));`));
assert.deepEqual(retained,{persons:0,receipts:1,memberships:1,audits:1});
console.log('PASS: simultaneous permanent-deletion retries and duplicate captures erase one profile, preserve one receipt/membership and record one deletion audit.');

const pending=JSON.parse(await sql('select public.create_registration('+sqlLiteral(JSON.stringify({...payload,mobile:'74'+suffix,aadhar_fingerprint:crypto.randomUUID().replaceAll('-','').repeat(2)}))+'::jsonb);'));
const pendingId=sqlLiteral(pending.id),pendingOrder='order_pending_race_'+suffix,pendingPayment='pay_pending_race_'+suffix;
const reservation=JSON.parse(await sql(`select public.prepare_payment_order(${pendingId});`));
await sql(`select public.record_payment_order(${pendingId},${sqlLiteral(pendingOrder)},${sqlLiteral(reservation.requestKey)});select public.admin_bulk_action(${sqlLiteral(admin)},array[${pendingId}::uuid],'trash','Pending capture race');`);
const raced=await Promise.all(Array.from({length:12},(_,index)=>sql(index%2===0?
 `select public.purge_admin_registrations(${sqlLiteral(admin)},array[${pendingId}::uuid],'purge-test-password');`:
 `select public.record_payment_event('pending_race_${suffix}_${index}','payment.captured',${sqlLiteral(pendingOrder)},${sqlLiteral(pendingPayment)},${pending.amountPaise},'INR','{}');`).then(JSON.parse)));
assert.ok(raced.every(result=>!result.failed));
assert.equal(raced.reduce((total,result)=>total+(result.changed??0),0),1);
const pendingResult=JSON.parse(await sql(`select jsonb_build_object('erased',(select erased_at is not null and person_id is null from public.registrations where id=${pendingId}),'captures',(select count(*) from public.payment_attempts where provider_payment_id=${sqlLiteral(pendingPayment)}),'memberships',(select count(*) from public.memberships where registration_id=${pendingId}),'liveFarmers',(select count(*) from public.farmers where registration_id=${pendingId} and erased_at is null));`));
assert.equal(pendingResult.erased,true);assert.equal(pendingResult.captures,1);assert.equal(pendingResult.liveFarmers,0);assert.ok(pendingResult.memberships<=1);
console.log('PASS: pending erasure racing the first capture retains one payment and never restores the erased profile.');
