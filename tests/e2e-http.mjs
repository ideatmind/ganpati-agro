// Opt-in isolated fixture test; intentionally refuses remote hosts.
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
const origin=process.env.TEST_APP_URL||'http://localhost:3100';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw Error('Only isolated loopback apps are allowed.');
let cookie='';const testIp='e2e-test-'+Date.now();
async function request(path,body,options={}){
  const response=await fetch(origin+path,{method:options.method||'POST',headers:{'content-type':'application/json',origin,cookie,'x-test-client-ip':testIp,...options.headers},body:body===undefined?undefined:JSON.stringify(body)});
  const set=response.headers.getSetCookie();if(set.length)cookie=set.map(value=>value.split(';')[0]).join('; ');
  return {status:response.status,data:await response.json()};
}
const seed=String(Date.now()).slice(-8);const body={name:'Isolated Test Farmer',mobile:'70'+seed,password:'test1234',date_of_birth:'1990-01-01',aadhar_no:'1234'+seed,village:'Fixture village',district:'dharashiv',taluka:'dharashiv',income_source:'agriculture',cluster_type:'pulses',referral_code:'',consent:true,cash_received:false,plots:[{plot_no:'Fixture-1',area_acres:1,crop_name:'तूर',irrigation_source:'well'}]};
for(const invalid of [{mobile:body.mobile+'0'},{mobile:body.mobile+'\n'},{aadhar_no:body.aadhar_no.slice(1)},{aadhar_no:body.aadhar_no+'\n'},{password:'1234567'}])assert.equal((await request('/api/registrations',{...body,...invalid},{headers:{'x-test-client-ip':testIp+'-validation'}})).status,400);
assert.equal((await request('/api/payments/orders',{registrationId:crypto.randomUUID()})).status,403);
assert.equal((await request('/api/registrations',body,{headers:{origin:'https://evil.example'}})).status,403);
const invalidName=await request('/api/registrations',{...body,name:'Farmer123'},{headers:{'x-test-client-ip':testIp+'-name'}});assert.equal(invalidName.status,400);assert.equal(invalidName.data.field,'name');assert.ok(!JSON.stringify(invalidName).includes('Farmer123'));
const invalidArea=await request('/api/registrations',{...body,plots:[{...body.plots[0],area_acres:0.001}]},{headers:{'x-test-client-ip':testIp+'-acre'}});assert.equal(invalidArea.status,400);
const staleFee=await request('/api/registrations',{...body,expected_fee_paise:1},{headers:{'x-test-client-ip':testIp+'-fee'}});assert.equal(staleFee.status,409);assert.equal(staleFee.data.code,'FEE_CHANGED');
assert.equal((await request('/api/farmers/'+crypto.randomUUID(),{name:'Changed Name'},{method:'PATCH'})).status,401);
assert.equal((await request('/api/registrations',{...body,test_mode:true},{headers:{'x-test-client-ip':testIp+'-mode'}})).status,400);
const registration=await request('/api/registrations',body);assert.equal(registration.status,201,JSON.stringify(registration));
assert.equal(registration.data.data.amountPaise,50000);
const checkoutCookie=cookie;
const oldPayload=Buffer.from(JSON.stringify({id:registration.data.data.id,exp:Date.now()+60000})).toString('base64url');
const oldSignature=createHmac('sha256','isolated-test-session-secret-more-than-32-characters').update('checkout:test:'+oldPayload).digest('base64url');
cookie='ga_checkout='+oldPayload+'.'+oldSignature;
assert.equal((await request('/api/payments/status',undefined,{method:'GET'})).data.data,null,'Old test checkout must not become live');
assert.equal((await request('/api/payments/orders',{registrationId:registration.data.data.id})).status,403);
cookie=checkoutCookie;
assert.ok(cookie.includes('ga_checkout='));
const retry=await request('/api/registrations',body);assert.equal(retry.data.data.id,registration.data.data.id);
const [first,second]=await Promise.all([request('/api/payments/orders',{registrationId:registration.data.data.id}),request('/api/payments/orders',{registrationId:registration.data.data.id})]);
const success=[first,second].find(result=>result.status===200);assert.ok(success,JSON.stringify([first,second]));
const order=success.data.data.providerOrderId;
const repeated=await request('/api/payments/orders',{registrationId:registration.data.data.id,test_mode:true});assert.equal(repeated.data.data.providerOrderId,order);assert.equal(repeated.data.data.keyId,'rzp_live_isolated','Request body cannot override signed checkout mode');
const payment=order.replace('order_isolated_','pay_isolated_');
const signature=createHmac('sha256','isolated-payment-secret').update(order+'|'+payment).digest('hex');
assert.equal((await request('/api/payments/verify',{orderId:order,paymentId:payment,signature:'invalid'})).status,400);
const verified=await request('/api/payments/verify',{orderId:order,paymentId:payment,signature});assert.equal(verified.status,200,JSON.stringify(verified));
const duplicate=await request('/api/payments/verify',{orderId:order,paymentId:payment,signature});assert.equal(duplicate.data.data.receiptToken,verified.data.data.receiptToken);
const webhookBody={event:'payment.captured',payload:{payment:{entity:{id:payment,order_id:order,status:'captured',amount:50000,currency:'INR'}}}};
const webhookSignature=createHmac('sha256','isolated-webhook-secret').update(JSON.stringify(webhookBody)).digest('hex');
assert.equal((await request('/api/payments/webhook',webhookBody,{headers:{'x-razorpay-event-id':'event_'+seed,'x-razorpay-signature':'invalid'}})).status,400);
for(let attempt=0;attempt<2;attempt++)assert.equal((await request('/api/payments/webhook',webhookBody,{headers:{'x-razorpay-event-id':'event_'+seed,'x-razorpay-signature':webhookSignature}})).status,200);
const restored=await request('/api/payments/status',undefined,{method:'GET'});assert.equal(restored.data.data.receiptToken,verified.data.data.receiptToken);
const receipt=await request('/api/receipts/'+verified.data.data.receiptToken,undefined,{method:'GET'});assert.equal(receipt.status,200);assert.ok(!JSON.stringify(receipt.data).includes(body.aadhar_no));assert.ok(!JSON.stringify(receipt.data).includes(body.mobile));
const login=await request('/api/auth/login',{mobile:body.mobile,password:body.password});assert.equal(login.status,200,JSON.stringify(login));
const sessionCookie=cookie;
assert.equal((await request('/api/admin/payouts',{})).status,403);
assert.equal((await request('/api/admin/aadhaar',{registrationId:registration.data.data.id})).status,403);
assert.equal((await request('/api/admin/bulk',{ids:[registration.data.data.id],action:'trash',reason:'Unauthorized attempt'})).status,403);
assert.equal((await request('/api/admin/bulk',{ids:[registration.data.data.id],action:'purge',password:'irrelevant'})).status,403);
assert.equal((await request('/api/auth/logout',{})).status,200);
cookie=sessionCookie;assert.equal((await request('/api/auth/password',{currentPassword:body.password,newPassword:'new isolated password'})).status,401);
cookie=checkoutCookie;assert.equal((await request('/api/payments/status',undefined,{method:'DELETE'})).status,200);
cookie='';assert.equal((await request('/api/auth/login',{mobile:'6999999998',password:'isolated admin password'})).status,200);
const adminCookie=cookie;
const staff=await request('/api/admin/staff',{name:'HTTP test employee',mobile:'72'+seed,password:'staff123',role:'employee'});assert.equal(staff.status,201,JSON.stringify(staff));
assert.equal((await request('/api/admin/staff',{accountId:staff.data.data.id,status:'disabled'},{method:'PATCH'})).status,200);
cookie='';assert.equal((await request('/api/auth/login',{mobile:'72'+seed,password:'staff123'})).status,401);
cookie=adminCookie;assert.equal((await request('/api/admin/staff',{accountId:staff.data.data.id,status:'active'},{method:'PATCH'})).status,200);
const options=await request('/api/admin/lookup?kind=employee&q=HTTP',undefined,{method:'GET'});assert.equal(options.status,200);assert.ok(options.data.data.some(x=>x.id===staff.data.data.id));
for(const section of ['registrations','staff','referrers','payouts','exceptions','grants','audit']){const response=await fetch(origin+'/dashboard/admin?section='+section,{headers:{cookie}});assert.equal(response.status,200);const html=await response.text();assert.ok(!html.includes(body.aadhar_no));assert.ok(html.includes('Admin console'));}
const detailResponse=await fetch(origin+'/dashboard/admin/registrations/'+registration.data.data.id+'?tab=payments',{headers:{cookie}});assert.equal(detailResponse.status,200);const detail=await detailResponse.text();assert.ok(detail.includes(order));assert.ok(!detail.includes(body.aadhar_no));
const profileResponse=await fetch(origin+'/dashboard/admin/registrations/'+registration.data.data.id,{headers:{cookie}});const profileHtml=await profileResponse.text();assert.equal(profileResponse.status,200);assert.ok(profileHtml.includes(body.mobile));assert.ok(profileHtml.includes(body.date_of_birth));assert.ok(profileHtml.includes('Fixture-1'));assert.ok(!profileHtml.includes(body.aadhar_no));assert.ok(!profileHtml.includes(body.password));
const reveal=await request('/api/admin/aadhaar',{registrationId:registration.data.data.id});assert.equal(reveal.status,200);assert.equal(reveal.data.data.aadhaar,body.aadhar_no);
assert.equal((await request('/api/admin/bulk',{ids:[registration.data.data.id],action:'trash',reason:'HTTP integration test'})).status,200);
const trashed=await fetch(origin+'/dashboard/admin?section=trash&q='+body.mobile,{headers:{cookie}});assert.equal(trashed.status,200);assert.ok((await trashed.text()).includes(body.name));
assert.equal((await request('/api/receipts/'+verified.data.data.receiptToken,undefined,{method:'GET'})).status,200);
assert.equal((await request('/api/admin/bulk',{ids:[registration.data.data.id],action:'restore'})).status,200);
const allMatching={ids:[],action:'trash',allMatching:true,expectedCount:1,filters:{q:body.mobile},reason:'Password confirmation HTTP test'};
const missingPassword=await request('/api/admin/bulk',allMatching);assert.equal(missingPassword.status,403);assert.equal(missingPassword.data.code,'PASSWORD_REQUIRED');
const wrongPassword=await request('/api/admin/bulk',{...allMatching,password:'wrong123'});assert.equal(wrongPassword.status,403);assert.equal(wrongPassword.data.code,'INVALID_PASSWORD');
assert.equal((await request('/api/admin/bulk',{...allMatching,password:'isolated admin password'})).status,200);
assert.equal((await request('/api/admin/bulk',{ids:[registration.data.data.id],action:'restore'})).status,200);
for(const kind of ['staff','payout','grant']){const page=await fetch(origin+'/dashboard/admin/new/'+kind,{headers:{cookie}});assert.equal(page.status,200);assert.ok((await page.text()).includes('<form'));}
assert.equal((await request('/api/admin/reconcile',{registrationId:registration.data.data.id})).status,200);
// Permanently erase a paid profile through the actual authenticated boundary.
assert.equal((await request('/api/admin/bulk',{ids:[registration.data.data.id],action:'trash',reason:'Permanent deletion HTTP test'})).status,200);
const trashPage=await fetch(origin+'/dashboard/admin?section=trash&q='+body.mobile,{headers:{cookie}});assert.equal(trashPage.status,200);
const purgeInput={ids:[registration.data.data.id],action:'purge',password:'wrong-password'};
assert.equal((await request('/api/admin/bulk',purgeInput)).status,403);
const purged=await request('/api/admin/bulk',{...purgeInput,password:'isolated admin password'});assert.equal(purged.status,200);assert.equal(purged.data.data.changed,1);
const deletedDetail=await fetch(origin+'/dashboard/admin/registrations/'+registration.data.data.id,{headers:{cookie}});const deletedHtml=await deletedDetail.text();assert.ok(!deletedHtml.includes(body.name));assert.ok(deletedHtml.includes('404')||deletedHtml.includes('NEXT_HTTP_ERROR_FALLBACK;404')); // Streamed notFound pages may return HTTP 200.
const retainedFinance=await fetch(origin+'/dashboard/admin/payments/'+registration.data.data.id,{headers:{cookie}});const financeHtml=await retainedFinance.text();assert.ok(financeHtml.includes('Payment history'));assert.ok(financeHtml.includes('Deleted farmer'));assert.ok(financeHtml.includes(order));assert.ok(!financeHtml.includes(body.aadhar_no));
assert.equal((await request('/api/admin/reconcile',{registrationId:registration.data.data.id})).status,200);
const trashAfter=await fetch(origin+'/dashboard/admin?section=trash&q='+body.mobile,{headers:{cookie}});assert.ok(!(await trashAfter.text()).includes(body.name));
// Pending payment is no longer a deletion blocker; stale checkout cannot restart it.
cookie='';
const pendingBody={...body,name:'Pending Erasure Farmer',mobile:'75'+seed,aadhar_no:'5678'+seed};
const pending=await request('/api/registrations',pendingBody,{headers:{'x-test-client-ip':testIp+'-pending'}});assert.equal(pending.status,201,JSON.stringify(pending));
const pendingCookie=cookie,pendingId=pending.data.data.id;
const pendingOrderResponse=await request('/api/payments/orders',{registrationId:pendingId});assert.equal(pendingOrderResponse.status,200);
const pendingOrder=pendingOrderResponse.data.data.providerOrderId,pendingPayment=pendingOrder.replace('order_isolated_','pay_isolated_');
cookie='';assert.equal((await request('/api/auth/login',{mobile:'6999999997',password:'isolated admin password'})).status,200);
assert.equal((await request('/api/admin/bulk',{ids:[pendingId],action:'trash',reason:'Delete pending profile'})).status,200);
const pendingPurged=await request('/api/admin/bulk',{ids:[pendingId],action:'purge',password:'isolated admin password'});assert.equal(pendingPurged.status,200,JSON.stringify(pendingPurged));assert.equal(pendingPurged.data.data.changed,1);
cookie=pendingCookie;assert.equal((await request('/api/payments/orders',{registrationId:pendingId})).status,404);
assert.equal((await request('/api/payments/verify',{orderId:pendingOrder,paymentId:pendingPayment,signature:createHmac('sha256','isolated-payment-secret').update(pendingOrder+'|'+pendingPayment).digest('hex')})).status,404);
const erasedStatus=await request('/api/payments/status',undefined,{method:'GET'});assert.equal(erasedStatus.status,200);assert.equal(erasedStatus.data.data,null);
const lateBody={event:'payment.captured',payload:{payment:{entity:{id:pendingPayment,order_id:pendingOrder,status:'captured',amount:50000,currency:'INR'}}}};
for(let i=0;i<2;i++)assert.equal((await request('/api/payments/webhook',lateBody,{headers:{'x-razorpay-event-id':'late_erasure_'+seed,'x-razorpay-signature':createHmac('sha256','isolated-webhook-secret').update(JSON.stringify(lateBody)).digest('hex')}})).status,200);
cookie=adminCookie;
const erasedFinance=await fetch(origin+'/dashboard/admin/payments/'+pendingId,{headers:{cookie}});const erasedFinanceHtml=await erasedFinance.text();assert.ok(erasedFinanceHtml.includes(pendingPayment));assert.ok(erasedFinanceHtml.includes('Deleted farmer'));assert.ok(!erasedFinanceHtml.includes(pendingBody.name));
assert.equal((await request('/api/admin/reconcile',{registrationId:pendingId})).status,200);
// Test each admin role with successful 204/no-content password RPC responses.
const managerMobile='73'+seed;
assert.equal((await request('/api/admin/staff',{name:'HTTP password manager',mobile:managerMobile,password:'manager8',role:'manager'})).status,201);
for(const account of [{mobile:'6999999998',password:'isolated admin password',next:'adminNew8'},{mobile:managerMobile,password:'manager8',next:'manager9'}]){
 if(account.mobile===managerMobile){cookie='';assert.equal((await request('/api/auth/login',account)).status,200);}
 const firstSession=cookie;
 const accountPage=await fetch(origin+'/dashboard/admin/account',{headers:{cookie}});assert.equal(accountPage.status,200);assert.ok((await accountPage.text()).includes('Confirm new password'));
 cookie='';assert.equal((await request('/api/auth/login',account)).status,200);const secondSession=cookie;cookie=firstSession;
 const wrong=await request('/api/auth/password',{currentPassword:'incorrect8',newPassword:account.next});assert.equal(wrong.status,403);assert.equal(wrong.data.code,'INVALID_CURRENT_PASSWORD');
 const changed=await request('/api/auth/password',{currentPassword:account.password,newPassword:account.next});assert.equal(changed.status,200,JSON.stringify(changed));assert.ok(!/ga_session=[^;]/.test(cookie));
 for(const revoked of [firstSession,secondSession]){cookie=revoked;assert.equal((await request('/api/admin/aadhaar',{registrationId:registration.data.data.id})).status,401);}
 cookie='';assert.equal((await request('/api/auth/login',{mobile:account.mobile,password:account.password})).status,401);
 assert.equal((await request('/api/auth/login',{mobile:account.mobile,password:account.next})).status,200);
 assert.equal((await request('/api/auth/password',{currentPassword:account.next,newPassword:account.password})).status,200);
}
console.log('PASS: isolated HTTP registration retry, checkout ownership, concurrent orders, signature rejection, capture deduplication, receipt privacy, reload recovery, authorization and logout replay.');
