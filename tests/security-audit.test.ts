import test from 'node:test';
import assert from 'node:assert/strict';
import {personNameSchema} from '../src/shared/person-name.ts';
import {registrationSchema} from '../src/features/registration/schema.ts';
import {profileChangesSchema} from '../src/features/registration/profile-schema.ts';
import {createDemoRegistration} from '../src/features/registration/demo-data.ts';
import {pendingPayoutSchema,readPendingPayout} from '../src/features/admin/pending-payout.ts';
import {validationFeedback} from '../src/shared/validation-feedback.ts';
import {paymentSecret} from '../src/server/payment-mode.ts';

test('person names preserve Marathi, initials and international punctuation while rejecting unrelated input',()=>{
 for(const name of ['Ramesh Patil','रामेश पाटील','A. R. Patil',"D’Souza","D'Souza",'Kadam-Patil','José Patil'])assert.equal(personNameSchema.safeParse(name).success,true,name);
 assert.equal(personNameSchema.parse('  रामेश   पाटील  '),'रामेश पाटील');
 for(const name of ['Name123','Farmer 😀','<script>','A..Patil','--Patil'])assert.equal(personNameSchema.safeParse(name).success,false,name);
 assert.equal(profileChangesSchema.safeParse({name:'Bad123'}).success,false);
});
test('server validation rejects fractional acre rounding, arbitrary crops/referrals and unsafe identities',()=>{
 const good={...createDemoRegistration(),consent:true};assert.equal(registrationSchema.safeParse(good).success,true);
 for(const area_acres of [true,0,-1,0.001,1.234,100001])assert.equal(registrationSchema.safeParse({...good,plots:[{...good.plots[0],area_acres}]}).success,false,String(area_acres));
 for(const referral_code of ['<x>','ABC_123','abc 123'])assert.equal(registrationSchema.safeParse({...good,referral_code}).success,false);
 assert.equal(registrationSchema.parse({...good,referral_code:'abc123'}).referral_code,'ABC123');
 const bad=registrationSchema.safeParse({...good,name:'private123'});assert.equal(bad.success,false);
 if(!bad.success){const feedback=validationFeedback(bad.error);assert.equal(feedback.field,'name');assert.ok(!JSON.stringify(feedback).includes('private123'));}
});
test('payout recovery preserves original payload/key and rejects corrupt or overposted storage',()=>{
 const payload={profileId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID(),amountRupees:'50.00',method:'cash',reference:'isolated-disbursement',note:''};
 assert.deepEqual(readPendingPayout(JSON.stringify(payload)),payload);
 assert.equal(readPendingPayout(null),null);
 assert.throws(()=>readPendingPayout('not json'));assert.equal(pendingPayoutSchema.safeParse({...payload,actorId:crypto.randomUUID()}).success,false);
});
test('payment secret fallback never pairs a key from one mode with the other mode secret',()=>{
 const keys=['RAZORPAY_KEY_ID','RAZORPAY_KEY_SECRET','RAZORPAY_LIVE_KEY_ID','RAZORPAY_LIVE_KEY_SECRET','RAZORPAY_TEST_KEY_ID','RAZORPAY_TEST_KEY_SECRET'];const old=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 try{for(const key of keys)delete process.env[key];process.env.RAZORPAY_KEY_ID='rzp_test_fixture';process.env.RAZORPAY_KEY_SECRET='test-only';
  assert.equal(paymentSecret('test'),'test-only');assert.throws(()=>paymentSecret('live'),{code:'PAYMENTS_UNAVAILABLE'});
  process.env.RAZORPAY_LIVE_KEY_ID='rzp_live_fixture';assert.throws(()=>paymentSecret('live'),{code:'PAYMENTS_UNAVAILABLE'});
  process.env.RAZORPAY_LIVE_KEY_SECRET='live-only';assert.equal(paymentSecret('live'),'live-only');
 }finally{for(const key of keys){if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];}}
});
