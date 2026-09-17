import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.TEST_APP_URL;
if(!origin||!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw Error('Use an isolated loopback app.');
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE});
try{
 for(const width of [320,390,1280]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/register');
  assert.equal(await page.locator('.plot-choices').first().evaluate(e=>e.disabled),true);
  await page.locator('#cluster').selectOption('spices');
  const first=page.locator('.farm-entry').first();
  await first.locator('input[value="हळद"]').check();await first.locator('input[value="मिरची"]').check();
  await first.locator('input[value=well]').focus();await page.keyboard.press('Space');
  await first.locator('input[value=drip]').check();
  assert.equal(await first.locator('.plot-choices').first().locator('input:checked').count(),2);
  assert.equal(await first.locator('.plot-choices').last().locator('input:checked').count(),2);
  await page.getByRole('button',{name:/Add Another Plot/}).click();
  await page.locator('.farm-entry').last().locator('input[value="आले"]').check();
  await page.locator('#cluster').selectOption('vegs');
  assert.equal(await first.locator('.plot-choices').first().locator('input:checked').count(),1);
  assert.equal(await first.locator('input[value="मिरची"]').isChecked(),true);
  assert.equal(await page.locator('.farm-entry').last().locator('input:checked').count(),0);
  assert.equal(await first.locator('input[value=drip]').isChecked(),true);
  await first.getByRole('button',{name:/Remove/}).click();
  assert.equal(await page.locator('.farm-entry input:checked').count(),0);
  assert.equal(await page.locator('[name="plots.0.crop_names"]').evaluate(e=>e.validity.valueMissing),true);
  await page.locator('[name="plots.0.crop_names"]').focus();await page.keyboard.press('Space');
  assert.equal(await page.locator('[name="plots.0.crop_names"]').evaluate(e=>e.validity.valid),true);
  await page.locator('input[value=well]').check();await page.locator('input[value=drip]').check();
  await page.locator('.farm-entry').scrollIntoViewIfNeeded();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const targets=await page.locator('.plot-choices-list label').evaluateAll(labels=>labels.map(e=>e.getBoundingClientRect().height));
  assert.ok(targets.every(height=>height>=44));
  await page.screenshot({path:`.audit/multi-select-${width}.png`});
  // Inspect the actual submission without opening a gateway.
  await page.locator('#farmer-name').fill('Browser Fixture');
  await page.locator('#mobile').fill('8999999911');await page.locator('#dob').fill('1990-01-01');
  await page.locator('#aadhar').fill('123456789012');await page.locator('#taluka').selectOption('dharashiv');
  await page.locator('#village').fill('Fixture village');await page.locator('#village').press('Tab');
  await page.locator('[name=income_source][value=agriculture]').check();
  await page.locator('#plot-0').fill('Fixture-1');await page.locator('#area-0').fill('2');
  await page.locator('#password').fill('fixture-password');await page.locator('#confirm-password').fill('fixture-password');
  await page.locator('[name=consent]').check();
  await page.locator('#cluster').selectOption('pulses');
  while(await page.locator('.farm-entry input:checked').count())await page.locator('.farm-entry input:checked').first().uncheck();
  await page.locator('input[value="तूर"]').check();await page.locator('input[value="हरभरा"]').check();
  await page.locator('input[value=well]').check();await page.locator('input[value=drip]').check();
  let payload;
  await page.route('**/api/registrations',async route=>{payload=route.request().postDataJSON();await route.fulfill({status:400,json:{error:'Synthetic check complete.'}});});
  await page.locator('.legacy-submit').click();await page.locator('.form-error').waitFor();
  assert.deepEqual(payload.plots[0].crop_names,['तूर','हरभरा']);
  assert.deepEqual(payload.plots[0].irrigation_sources,['well','drip']);
  assert.deepEqual(errors,[]);await context.close();
  console.log(`PASS ${width}px: keyboard, multi-choice payload, cluster reset, plot removal, validation, touch targets and overflow`);
 }
 for(const [role,mobile,path] of [['admin','6800000001','/dashboard/admin/registrations/'+process.env.MULTI_REG],['employee','6800000003','/dashboard/farmers/'+process.env.MULTI_FARMER]]){
  const context=await browser.newContext({viewport:{width:390,height:900}});const page=await context.newPage();
  await page.goto(origin+'/login');await page.locator('[name=mobile]').fill(mobile);await page.locator('[name=password]').fill('role test password');
  await page.locator('form .button').last().click();await page.waitForURL(url=>url.pathname.startsWith('/dashboard'));
  await page.goto(origin+path);
  await page.getByRole('heading',{name:role==='admin'?'Farm & plot information':'Plots',exact:true}).waitFor();
  const text=await page.locator('body').innerText();
  for(const label of ['Chickpea','Pigeon Pea','Well','Drip'])assert.ok(text.includes(label),`${role}: missing ${label}`);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await context.close();console.log(`PASS ${role}: all crop and irrigation labels displayed`);
 }
}finally{await browser.close();}
