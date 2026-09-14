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
  `select public.finalize_registration_payment(${sqlLiteral(order)},${sqlLiteral(payment)},50000,'INR','farmer',true);`:
  `select public.record_payment_event('event_concurrent_${suffix}_${index}','payment.captured',${sqlLiteral(order)},${sqlLiteral(payment)},50000,'INR','{}');`).then(JSON.parse)));
assert.equal(new Set(completed.map(result=>result.receiptToken)).size,1,'Capture race returned inconsistent receipts');
const count=JSON.parse(await sql(`select jsonb_build_object('farmers',(select count(*) from public.farmers where registration_id=${id}),'memberships',(select count(*) from public.memberships where registration_id=${id}),'receipts',(select count(*) from public.receipts where registration_id=${id}),'attempts',(select count(*) from public.payment_attempts where provider_payment_id=${sqlLiteral(payment)}));`));
assert.deepEqual(count,{farmers:1,memberships:1,receipts:1,attempts:1});
console.log('PASS: 12 concurrent order reservations and 12 simultaneous browser/webhook captures produce one order reservation, farmer, membership, receipt and capture.');
