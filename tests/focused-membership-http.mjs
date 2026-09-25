import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {expireAccountRateLimit} from './support/rate-limit-fixture.mjs';
const origin=process.env.TEST_APP_URL;
if(!origin||!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw Error('Use an isolated loopback app.');
const jar=new Map();
const suffix=String(Date.now()).slice(-8);
let requestNumber=0;
async function request(path,body,method=body===undefined?'GET':'POST'){
 const response=await fetch(origin+path,{method,headers:{'content-type':'application/json',origin,cookie:[...jar].map(([key,value])=>key+'='+value).join('; '),'x-test-client-ip':'membership-http-'+suffix+'-'+requestNumber++},body:body===undefined?undefined:JSON.stringify(body)});
 for(const header of response.headers.getSetCookie()){const pair=header.split(';')[0];const at=pair.indexOf('=');jar.set(pair.slice(0,at),pair.slice(at+1));}
 return {status:response.status,data:await response.json()};
}
const body={name:'Membership HTTP Farmer',mobile:'61'+suffix,password:'membership http password',date_of_birth:'1990-01-01',aadhar_no:'3461'+suffix,village:'Fixture village',district:'dharashiv',taluka:'dharashiv',income_source:'agriculture',cluster_type:'pulses',referral_code:'',consent:true,expected_fee_paise:50000,plots:[{plot_no:'HTTP-1',area_acres:1,crop_names:['तूर'],irrigation_sources:['well']}]};
async function pay(registration,membershipType){
 const order=await request('/api/payments/orders',{registrationId:registration.id,membershipType});
 assert.equal(order.status,200,JSON.stringify(order));
 assert.equal(order.data.data.amountPaise,membershipType==='standard'?50000:250000);
 const orderId=order.data.data.providerOrderId,paymentId=orderId.replace('order_isolated_','pay_isolated_');
 const signature=createHmac('sha256','isolated-payment-secret').update(orderId+'|'+paymentId).digest('hex');
 const result=await request('/api/payments/verify',{orderId,paymentId,signature,membershipType});
 assert.equal(result.status,200,JSON.stringify(result));
 const again=await request('/api/payments/verify',{orderId,paymentId,signature,membershipType});
 assert.equal(again.data.data.receiptToken,result.data.data.receiptToken);
 return result.data.data.receiptToken;
}
const standard=await request('/api/registrations',body);
assert.equal(standard.status,201,JSON.stringify(standard));
const standardReceipt=await pay(standard.data.data,'standard');
const focus={...body,membership_type:'focused_value_chain',cluster_type:'fruits',expected_fee_paise:250000,plots:[{...body.plots[0],crop_names:['डाळिंब','पेरू']}]};
assert.equal((await request('/api/registrations',focus)).status,401,'Additional membership did not require member sign-in');
assert.equal((await request('/api/auth/login',{mobile:body.mobile,password:body.password})).status,200);
assert.equal((await request('/api/registrations',{...focus,expected_fee_paise:50000})).status,409);
assert.equal((await request('/api/registrations',{...focus,plots:[{...focus.plots[0],crop_names:['द्राक्ष']}]})).status,400);
assert.equal((await request('/api/registrations',{...focus,name:'Different Person'})).status,409);
// The negative cases deliberately use the full shared authentication budget.
expireAccountRateLimit(body.mobile);
const focused=await request('/api/registrations',focus);
assert.equal(focused.status,201,JSON.stringify(focused));
assert.equal(focused.data.data.amountPaise,250000);
assert.ok(jar.has('ga_checkout')&&jar.has('ga_focused_checkout')&&jar.has('ga_session'));
assert.equal((await request('/api/payments/status')).data.data.id,standard.data.data.id);
assert.equal((await request('/api/payments/status?membershipType=focused_value_chain')).data.data.id,focused.data.data.id);
assert.equal((await request('/api/payments/orders',{registrationId:focused.data.data.id,membershipType:'standard'})).status,403,'Focused checkout used the standard capability');
const focusedReceipt=await pay(focused.data.data,'focused_value_chain');
assert.notEqual(focusedReceipt,standardReceipt);
const receipt=await request('/api/receipts/'+focusedReceipt);
assert.equal(receipt.data.data.membershipType,'focused_value_chain');
assert.equal(receipt.data.data.amountPaise,250000);
assert.ok(!JSON.stringify(receipt.data).includes(body.aadhar_no));
const dashboard=await fetch(origin+'/dashboard',{headers:{cookie:[...jar].map(([k,v])=>k+'='+v).join('; ')}});
const dashboardHtml=await dashboard.text();
assert.equal(dashboard.status,200);
assert.ok(dashboardHtml.includes(standard.data.data.reference)||dashboardHtml.includes(standardReceipt));
assert.ok(dashboardHtml.includes(focusedReceipt));
assert.equal((await request('/api/auth/logout',{})).status,200);
assert.equal(jar.get('ga_checkout'),'');
assert.equal(jar.get('ga_focused_checkout'),'');
jar.clear();
assert.equal((await request('/api/auth/login',{mobile:'6999999998',password:'isolated admin password'})).status,200);
const cookies=[...jar].map(([k,v])=>k+'='+v).join('; ');
const filtered=await fetch(origin+'/dashboard/admin?section=registrations&membershipType=focused_value_chain',{headers:{cookie:cookies}});
const html=await filtered.text();
assert.equal(filtered.status,200);
assert.ok(html.includes(focused.data.data.reference));
assert.ok(!html.includes(standard.data.data.reference),'Membership filter mixed standard records into focused results');
console.log('PASS: HTTP standard signup, signed-in focused purchase, isolated cookies, ₹2,500 payment, duplicate verification, receipts, dashboard and admin filtering.');
