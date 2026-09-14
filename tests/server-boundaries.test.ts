import assert from "node:assert/strict";
import test from "node:test";
import {createHmac,createDecipheriv} from "node:crypto";
import {createToken,readToken} from "../src/server/signed-token.ts";
import {verifyCheckoutSignature,verifyWebhookSignature} from "../src/server/razorpay.ts";
import {readBody,readJson,api} from "../src/server/http.ts";
import {registrationSchema} from "../src/features/registration/schema.ts";
import {profileChangesSchema} from "../src/features/registration/profile-schema.ts";
import {protectAadhaar} from "../src/server/pii.ts";
import {startOrder} from "../src/features/payments/server/payments.ts";

process.env.SESSION_SECRET='test-only-secret-32-bytes-or-more-never-production';
process.env.RAZORPAY_KEY_SECRET='synthetic-payment-secret';
process.env.RAZORPAY_WEBHOOK_SECRET='synthetic-webhook-secret';
process.env.PAYMENT_DEMO_MODE='false';
process.env.PII_ENCRYPTION_KEY='1'.repeat(64);

test('production rejects test checkout before reserving an order',async()=>{
  const previousEnvironment=process.env.VERCEL_ENV;
  const previousKey=process.env.RAZORPAY_KEY_ID;
  process.env.VERCEL_ENV='production';process.env.RAZORPAY_KEY_ID='rzp_test_isolated';
  try{await assert.rejects(()=>startOrder('12345678-1234-4234-8234-123456789012'),{code:'PAYMENTS_UNAVAILABLE'});}
  finally{
    if(previousEnvironment===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=previousEnvironment;
    if(previousKey===undefined)delete process.env.RAZORPAY_KEY_ID;else process.env.RAZORPAY_KEY_ID=previousKey;
  }
});

test('PII protection uses randomized authenticated encryption and stable keyed uniqueness',()=>{
  const first=protectAadhaar('000000000000');const second=protectAadhaar('000000000000');
  assert.equal(first.fingerprint,second.fingerprint);assert.notEqual(first.ciphertext,second.ciphertext);
  const [iv,tag,ciphertext]=first.ciphertext.split('.').map(value=>Buffer.from(value,'base64url'));
  const decipher=createDecipheriv('aes-256-gcm',Buffer.from(process.env.PII_ENCRYPTION_KEY!,'hex'),iv);decipher.setAuthTag(tag);
  assert.equal(Buffer.concat([decipher.update(ciphertext),decipher.final()]).toString(),'000000000000');
  process.env.PII_ENCRYPTION_KEY='1'.repeat(64)+'zz';assert.throws(()=>protectAadhaar('000000000000'));process.env.PII_ENCRYPTION_KEY='1'.repeat(64);
});

test('signed capabilities enforce purpose, signature, expiry and strict format',()=>{
  const id='12345678-1234-4234-8234-123456789012';const token=createToken(id,'checkout',60);
  assert.equal(readToken(token,'checkout'),id);
  assert.equal(readToken(token,'session'),null);
  assert.equal(readToken(token+'suffix','checkout'),null);
  assert.equal(readToken(token+'.extra','checkout'),null);
  assert.equal(readToken(createToken(id,'checkout',-1),'checkout'),null);
  const old=process.env.SESSION_SECRET;process.env.SESSION_SECRET='short';
  assert.throws(()=>createToken(id,'checkout',60));process.env.SESSION_SECRET=old;
});
test('payment signatures bind both identifiers and exact webhook bytes',()=>{
  const signature=createHmac('sha256',process.env.RAZORPAY_KEY_SECRET!).update('order_test|pay_test').digest('hex');
  assert.equal(verifyCheckoutSignature('order_test','pay_test',signature),true);
  assert.equal(verifyCheckoutSignature('order_other','pay_test',signature),false);
  assert.equal(verifyCheckoutSignature('order_test','pay_test','invalid'),false);
  assert.equal(verifyCheckoutSignature('demo_order_test','demo_payment_test','demo'),false);
  const raw='{"event":"payment.captured"}';const webhook=createHmac('sha256',process.env.RAZORPAY_WEBHOOK_SECRET!).update(raw).digest('hex');
  assert.equal(verifyWebhookSignature(raw,webhook),true);assert.equal(verifyWebhookSignature(raw+' ',webhook),false);
});
test('request parsing bounds real streamed bytes and rejects malformed JSON',async()=>{
  await assert.rejects(()=>readBody(new Request('https://test.example',{method:'POST',body:'12345'}),4));
  await assert.rejects(()=>readJson(new Request('https://test.example',{method:'POST',body:'{',headers:{'content-type':'application/json'}})));
  await assert.rejects(()=>readJson(new Request('https://test.example',{method:'POST',body:'{}'})));
  assert.deepEqual(await readJson(new Request('https://test.example',{method:'POST',body:'{}',headers:{'content-type':'application/json'}})),{});
});
test('errors never disclose exception details or PII',async()=>{
  const response=await api(new Request('https://test.example'),async()=>{throw Error('password=secret SQL aadhar=123456789012');});
  assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'private, no-store');
  const output=await response.text();assert.doesNotMatch(output,/password|SQL|aadhar|123456789012/);assert.ok(response.headers.get('x-request-id'));
});
test('profile changes reject overposting, invalid dates and cross-district talukas',()=>{
  assert.equal(profileChangesSchema.safeParse({role:'super_admin'}).success,false);
  assert.equal(profileChangesSchema.safeParse({date_of_birth:'2999-01-01'}).success,false);
  assert.equal(profileChangesSchema.safeParse({district:'solapur',taluka:'dharashiv'}).success,false);
  assert.equal(profileChangesSchema.safeParse({village:' Valid village '}).success,true);
  assert.equal(registrationSchema.shape.password.safeParse('a'.repeat(73)).success,false);
  assert.equal(registrationSchema.shape.password.safeParse('श'.repeat(25)).success,false);
});
