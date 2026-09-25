import assert from 'node:assert/strict';
import {expireAccountRateLimit} from './support/rate-limit-fixture.mjs';

const origin=process.env.TEST_APP_URL;
if(!origin||!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw Error('Use an isolated loopback app.');
const suffix=String(Date.now()).slice(-8);
let requestNumber=0;
async function request(path,body){
 const response=await fetch(origin+path,{
  method:'POST',
  headers:{'content-type':'application/json',origin,'x-test-client-ip':'registration-security-'+suffix+'-'+requestNumber++},
  body:JSON.stringify(body)
 });
 return {status:response.status,data:await response.json(),retryAfter:response.headers.get('retry-after')};
}
function fixture(prefix){
 return {name:'Rate Limit Fixture Farmer',mobile:prefix+suffix,password:'fixture password',date_of_birth:'1990-01-01',aadhar_no:'81'+prefix+suffix,
  village:'Fixture village',district:'dharashiv',taluka:'dharashiv',income_source:'agriculture',cluster_type:'pulses',referral_code:'',consent:true,expected_fee_paise:50000,
  plots:[{plot_no:'Rate-limit fixture',area_acres:1,crop_names:['तूर'],irrigation_sources:['well']}]};
}
const focused=body=>({...body,membership_type:'focused_value_chain',cluster_type:'fruits',expected_fee_paise:250000,plots:[{...body.plots[0],crop_names:['डाळिंब']}]});
function limited(result){
 assert.equal(result.status,429,JSON.stringify(result));
 assert.equal(result.data.code,'RATE_LIMITED');
 assert.equal(result.retryAfter,'60');
}

// Every request has a distinct trusted test IP. Registration failures must commit
// their account budget even when the following create-membership transaction rolls back.
const first=fixture('66');
const created=await request('/api/registrations',first);
assert.equal(created.status,201,JSON.stringify(created));
for(let attempt=0;attempt<4;attempt++){
 const result=await request('/api/registrations',{...(attempt%2?focused(first):first),password:'incorrect password'});
 assert.equal(result.status,409,JSON.stringify(result));
 assert.equal(result.data.code,'REGISTRATION_CONFLICT');
}
limited(await request('/api/registrations',first));
limited(await request('/api/registrations',focused(first)));
limited(await request('/api/auth/login',{mobile:first.mobile,password:first.password}));

// A different account has its own budget, but login and registration share it.
const second=fixture('67');
const another=await request('/api/registrations',second);
assert.equal(another.status,201,JSON.stringify(another));
assert.equal((await request('/api/auth/login',{mobile:second.mobile,password:'incorrect password'})).status,401);
assert.equal((await request('/api/registrations',{...second,password:'incorrect password'})).status,409);
assert.equal((await request('/api/auth/login',{mobile:second.mobile,password:'incorrect password'})).status,401);
const retry=await request('/api/registrations',second);
assert.equal(retry.status,201,JSON.stringify(retry));
assert.equal(retry.data.data.id,another.data.data.id);
limited(await request('/api/auth/login',{mobile:second.mobile,password:second.password}));
limited(await request('/api/registrations',second));

// Advance this synthetic bucket's clock without waiting or weakening app policy.
expireAccountRateLimit(first.mobile);
const recovered=await request('/api/registrations',first);
assert.equal(recovered.status,201,JSON.stringify(recovered));
assert.equal(recovered.data.data.id,created.data.data.id);
console.log('PASS: account throttling survives rotating IPs, failed registration transactions, membership switching and mixed login/registration attempts; separate accounts and expired budgets still work.');
