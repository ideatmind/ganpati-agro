import assert from 'node:assert/strict';
import test from 'node:test';
import {registrationSchema} from '../src/features/registration/schema.ts';
import {createDemoRegistration} from '../src/features/registration/demo-data.ts';
import {FOCUSED_CROPS,membershipCategories,membershipPath,registrationReturnPath} from '../src/features/registration/membership.ts';
import {adminQuery,bulkActionSchema} from '../src/features/admin/schema.ts';

const base={...createDemoRegistration(),consent:true,website:''};
test('the default form remains standard and exposes the complete existing crop catalog',()=>{
 assert.equal(registrationSchema.parse(base).membership_type,'standard');
 assert.equal(membershipPath('standard'),'/register');
 assert.equal(membershipCategories('standard').length,13);
 assert.deepEqual(new Set(membershipCategories('focused_value_chain').flatMap(c=>c.crops)),new Set(FOCUSED_CROPS));
});
test('focused membership accepts precisely its six crops within the matching cluster',()=>{
 for(const crop of FOCUSED_CROPS){
  const cluster=['कुक्कुटपालन','शेळी पालन'].includes(crop)?'allied':'fruits';
  const body={...base,membership_type:'focused_value_chain',cluster_type:cluster,plots:[{...base.plots[0],crop_names:[crop]}]};
  assert.ok(registrationSchema.safeParse(body).success,crop);
 }
 for(const [cluster,crop] of [['fruits','द्राक्ष'],['pulses','तूर'],['allied','मत्स्यपालन'],['fruits','कुक्कुटपालन']]){
  assert.equal(registrationSchema.safeParse({...base,membership_type:'focused_value_chain',cluster_type:cluster,plots:[{...base.plots[0],crop_names:[crop]}]}).success,false,crop);
 }
 assert.equal(registrationSchema.safeParse({...base,membership_type:'discounted'}).success,false);
});
test('admin membership filters survive pagination and all-matching bulk selection',()=>{
 const filters={q:'Farmer',status:'payment_pending',membershipType:'focused_value_chain',from:'',to:''};
 assert.equal(adminQuery.parse({...filters,section:'registrations',page:'2'}).membershipType,'focused_value_chain');
 assert.equal(bulkActionSchema.parse({ids:[],action:'trash',reason:'Test selection',allMatching:true,expectedCount:3,filters}).filters?.membershipType,'focused_value_chain');
 assert.equal(adminQuery.safeParse({membershipType:'forged'}).success,false);
});

test('member sign-in preserves only safe registration destinations and referral codes',()=>{
 assert.equal(registrationReturnPath('/register/focused-value-chain?ref=FOCUSREF'),'/register/focused-value-chain?ref=FOCUSREF');
 for(const value of ['https://evil.invalid/register','//evil.invalid/register','/dashboard/admin','javascript:alert(1)'])assert.equal(registrationReturnPath(value),'/dashboard');
});
