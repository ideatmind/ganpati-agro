import assert from "node:assert/strict";
import test from "node:test";
import { rupeesToPaise } from "../src/shared/money.ts";
import { allowedMutation } from "../src/shared/request-policy.ts";
import { paymentSchema, isMatchingCapture } from "../src/features/payments/schema.ts";

test("payout amounts preserve paise and reject rounding or unsafe input",()=>{
  assert.equal(rupeesToPaise('1.01'),101);assert.equal(rupeesToPaise('1000000'),100000000);
  for(const value of ['0','-1','0.001','1e3','NaN','1000001','Infinity',' 10','1.'])assert.throws(()=>rupeesToPaise(value));
});
test("mutations require the configured origin and reject sibling and cross-site origins",()=>{
  const request=(origin?:string,site='same-origin')=>new Request('https://agro.example/api/auth/login',{method:'POST',headers:{...(origin?{origin}:{}),'sec-fetch-site':site}});
  assert.equal(allowedMutation(request('https://agro.example'),'https://agro.example'),true);
  assert.equal(allowedMutation(request()),false);
  assert.equal(allowedMutation(request('https://evil.example')),false);
  assert.equal(allowedMutation(request('https://agro.example','cross-site')),false);
  assert.equal(allowedMutation(request('https://agro.example'),'https://production.example'),false);
});
test("only a captured payment for the exact order, integer fee and INR qualifies",()=>{
  const payment={id:'pay_test',order_id:'order_test',status:'captured',amount:50000,currency:'INR'} as const;
  assert.ok(isMatchingCapture(payment,'order_test',50000));
  assert.equal(isMatchingCapture({...payment,status:'authorized'},'order_test',50000),false);
  assert.equal(isMatchingCapture(payment,'order_other',50000),false);
  assert.equal(isMatchingCapture(payment,'order_test',1),false);
  for(const change of [{amount:50000.1},{amount:-1},{currency:'USD'},{order_id:undefined}]) assert.equal(paymentSchema.safeParse({...payment,...change}).success,false);
});
