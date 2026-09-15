// Use the isolated role fixtures and app environment described in ROLE_UI_REMEDIATION_20260916.md.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.TEST_APP_URL;
if(!base||!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Use an isolated loopback app.');
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE}:{})});
const titles={overview:'Overview',registrations:'Registrations',trash:'Trash',exceptions:'Payment exceptions',referrers:'Referral balances',payouts:'Payout history',grants:'Edit permissions',audit:'Activity log'};
try{
 for(const width of [390,1280])for(const role of ['super_admin','manager']){
  const context=await browser.newContext({viewport:{width,height:900}});const page=await context.newPage();
  await page.goto(base+'/login');await page.locator('[name=mobile]').fill(role==='super_admin'?'6800000001':'6800000002');await page.locator('[name=password]').fill('role test password');await page.locator('form .button').last().click();await page.waitForURL('**/dashboard/admin');
  for(const section of [role==='super_admin'?'trash':'registrations','exceptions','referrers','payouts','staff','grants','audit','staff','referrers','overview','registrations','overview']){
   if(width<850)await page.getByRole('button',{name:'Workspace menu'}).click();
   await page.locator(`#admin-navigation a[href="/dashboard/admin?section=${section}"]`).click();
   await page.getByRole('heading',{name:section==='staff'?(role==='super_admin'?'Team & access':'Team activity'):titles[section],exact:true}).waitFor();
   const forms=page.locator('form.admin-filters');assert.equal(await forms.count(),section==='overview'?0:1,`${role} ${width}px ${section}: stale filter form`);
   if(section!=='overview')assert.equal(await forms.locator('[name=section]').inputValue(),section);
  }
  if(width<850)await page.getByRole('button',{name:'Workspace menu'}).click();
  await page.locator('#admin-navigation a[href="/dashboard/admin?section=registrations"]').click();await page.getByRole('heading',{name:'Registrations',exact:true}).waitFor();
  for(const query of ['Role','Farmer']){
   await page.locator('form.admin-filters [name=q]').fill(query);await page.getByRole('button',{name:'Apply',exact:true}).click();
   await page.waitForFunction(q=>document.querySelector('form.admin-filters [name=q]')?.defaultValue===q,query);
   assert.equal(await page.locator('form.admin-filters').count(),1,'Applying filters duplicated the form');
  }
  await page.goBack();await page.waitForFunction(()=>document.querySelector('form.admin-filters [name=q]')?.defaultValue==='Role');assert.equal(await page.locator('form.admin-filters').count(),1);
  await page.goForward();await page.waitForFunction(()=>document.querySelector('form.admin-filters [name=q]')?.defaultValue==='Farmer');assert.equal(await page.locator('form.admin-filters').count(),1);
  console.log(`PASS ${role} ${width}px: repeated navigation, Overview, filter submission and browser history`);await context.close();
 }
}finally{await browser.close();}
