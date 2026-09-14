import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const origin=process.env.TEST_APP_URL;
if(!origin||new URL(origin).hostname!=='localhost')throw Error('Isolated localhost app required');
const samples={};let jar='';let ip=0;
async function run(name,path,body,method=body?'POST':'GET'){
 const t=performance.now();const r=await fetch(origin+path,{method,headers:{origin,cookie:jar,'content-type':'application/json','x-test-client-ip':'perf-'+ip++},body:body?JSON.stringify(body):undefined});const ttfb=performance.now()-t;const text=await r.text();
 assert.ok(r.ok,`${name}: ${r.status} ${text.slice(0,150)}`);const total=performance.now()-t;
 (samples[name]??=[]).push({ttfb,total,bytes:Buffer.byteLength(text),serverTiming:r.headers.get('server-timing')});
 for(const value of r.headers.getSetCookie()){const [entry]=value.split(';');const key=entry.split('=')[0];jar=jar.split('; ').filter(x=>x&&!x.startsWith(key+'=')).concat(entry).join('; ');}
 return text.startsWith('{')?JSON.parse(text).data:text;
}
for(const [name,path] of Object.entries({home:'/',registrationPage:'/register',loginPage:'/login'}))for(let i=0;i<20;i++)await run(name,path);
for(let i=0;i<20;i++){
 jar='';const seed=String(Date.now()).slice(-8);const body={name:'Performance Test',mobile:'71'+seed,password:'isolated testing password',date_of_birth:'1990-01-01',aadhar_no:'4321'+seed,village:'Synthetic village',district:'dharashiv',taluka:'dharashiv',income_source:'agriculture',cluster_type:'pulses',referral_code:'',consent:true,cash_received:false,plots:[{plot_no:'1',area_acres:1,crop_name:'तूर',irrigation_source:'well'}]};
 const registration=await run('registrationSave','/api/registrations',body);const order=await run('order','/api/payments/orders',{registrationId:registration.id});const payment=order.providerOrderId.replace('order_isolated_','pay_isolated_');const signature=createHmac('sha256','isolated-payment-secret').update(order.providerOrderId+'|'+payment).digest('hex');
 const confirmed=await run('verification','/api/payments/verify',{orderId:order.providerOrderId,paymentId:payment,signature});await run('status','/api/payments/status');await run('receipt','/receipt/'+confirmed.receiptToken);
 await run('login','/api/auth/login',{mobile:body.mobile,password:body.password});await run('dashboard','/dashboard');
}
jar='';await run('adminLogin','/api/auth/login',{mobile:'6999999999',password:'isolated performance password'});
for(let i=0;i<20;i++)await run('admin','/dashboard/admin');
const result={environment:'Local production build, isolated 10k-fixture Postgres with per-RPC psql bridge, synthetic Razorpay; excludes real gateway and WAN latency',recordedAt:new Date().toISOString(),routes:{}};
for(const [name,rows] of Object.entries(samples)){const values=rows.map(x=>x.total).sort((a,b)=>a-b);const headers=rows.map(x=>x.ttfb).sort((a,b)=>a-b);result.routes[name]={samples:rows.length,p50:Math.round(values[Math.floor((values.length-1)*.5)]),p95:Math.round(values[Math.floor((values.length-1)*.95)]),p99:Math.round(values.at(-1)),ttfbP95:Math.round(headers[Math.floor((headers.length-1)*.95)]),bytes:rows.at(-1).bytes,serverTiming:rows.at(-1).serverTiming};}
writeFileSync(`docs/MVP_${process.env.PERF_LABEL==='after'?'AFTER':'BEFORE'}_HTTP.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
