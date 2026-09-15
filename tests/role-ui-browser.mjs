// Run against a freshly seeded, isolated local app; see ROLE_UI_REMEDIATION_20260916.md.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.TEST_APP_URL;const database=process.env.TEST_DATABASE_URL;
if(!base||!database||![base,database].every(value=>['localhost','127.0.0.1'].includes(new URL(value).hostname)))throw Error('Use an isolated loopback app and database.');
function sql(query){const r=spawnSync(process.env.PSQL_PATH||'psql',['-X','-At','-v','ON_ERROR_STOP=1','-d',database,'-c',query],{encoding:'utf8',windowsHide:true});if(r.status)throw Error(r.stderr);return r.stdout.trim();}
const fixture=JSON.parse(sql("select json_build_object('farmer',(select f.id from public.farmers f join public.persons p on p.id=f.person_id where p.mobile='6800000011'),'registration',(select g.id from public.registrations g join public.persons p on p.id=g.person_id where p.mobile='6800000011'),'otherFarmer',(select f.id from public.farmers f join public.persons p on p.id=f.person_id where p.mobile='6800000012'),'pending',(select g.id from public.registrations g join public.persons p on p.id=g.person_id where p.mobile='6800000013'))"));
const results=[];const errors=[];const contexts={};mkdirSync('.audit/role-ui-results',{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE}:{})});
const checks=async(name,action)=>{await action();results.push(name);console.log('PASS '+name);};
async function open(page,path){await page.goto(base+path);await page.locator('h1').filter({hasNotText:/^Loading/}).first().waitFor();}
async function denied(page,path,method='POST',data={}){const r=await page.request.fetch(base+path,{method,headers:{Origin:base,'Content-Type':'application/json'},...(method==='GET'?{}:{data})});assert.equal(r.status(),403,`${method} ${path}`);}
try{
 for(const [role,suffix]of [['referrer',4],['employee',3],['manager',2],['super_admin',1]]){
  const context=await browser.newContext({viewport:{width:1280,height:900}});contexts[role]=context;const page=await context.newPage();page.on('pageerror',e=>errors.push({role,error:e.message}));
  await checks(role+' login and landing',async()=>{await open(page,'/login');await page.locator('[name=mobile]').fill('680000000'+suffix);await page.locator('[name=password]').fill('role test password');await page.locator('form button[type=submit],form .button').last().click();await page.waitForURL(url=>role==='manager'||role==='super_admin'?url.pathname==='/dashboard/admin':url.pathname==='/dashboard');await page.locator('h1').waitFor();});
  await checks(role+' navigation and direct URL/API permissions',async()=>{
   if(role==='referrer'||role==='employee'){
    assert.equal(await page.getByRole('navigation',{name:'Admin navigation'}).count(),0);
    for(const path of ['/dashboard/admin','/dashboard/admin?section=staff','/dashboard/admin/new/staff','/dashboard/admin?section=trash','/dashboard/admin/payments/'+fixture.registration]){await open(page,path);assert.equal(new URL(page.url()).pathname,'/dashboard');}
    for(const path of ['/api/admin/staff','/api/admin/payouts','/api/admin/grants','/api/admin/bulk','/api/admin/aadhaar','/api/admin/reconcile'])await denied(page,path);
    await denied(page,'/api/admin/lookup?kind=employee&q=Role','GET');
    if(role==='referrer')await denied(page,'/api/farmers/'+fixture.farmer,'PATCH',{name:'Unauthorized Name'});
   }else{
    const nav=page.getByRole('navigation',{name:'Admin navigation'});
    assert.equal(await nav.getByRole('link',{name:'Trash',exact:true}).count(),role==='super_admin'?1:0);
    if(role==='manager'){
     assert.equal(await nav.getByRole('link',{name:'Team activity',exact:true}).count(),1);
     await open(page,'/dashboard/admin/new/staff');assert.equal(new URL(page.url()).pathname,'/dashboard/admin');assert.equal(await page.getByRole('link',{name:'Add team member'}).count(),0);
     await open(page,'/dashboard/admin?section=trash');assert.equal(new URL(page.url()).searchParams.get('section'),null);
     await denied(page,'/api/admin/staff');await denied(page,'/api/admin/aadhaar');
     await denied(page,'/api/admin/bulk','POST',{ids:[fixture.registration],action:'trash',reason:'Denied fixture'});
    }
   }
  });
  await checks(role+' responsive page matrix',async()=>{
   const paths=role==='manager'||role==='super_admin'?['/dashboard/admin',...['registrations','staff','referrers','payouts','grants','exceptions','audit',...(role==='super_admin'?['trash']:[])].map(s=>'/dashboard/admin?section='+s),'/dashboard/admin/new/payout','/dashboard/admin/new/grant',...(role==='super_admin'?['/dashboard/admin/new/staff']:[]),'/dashboard/admin/account','/dashboard/admin/registrations/'+fixture.registration,'/dashboard/admin/payments/'+fixture.registration,'/dashboard?personal=1']:['/dashboard',...(role==='employee'?['/dashboard/farmers/'+fixture.farmer]:[])];
   for(const width of [320,768,1280,1600])for(const path of paths){await page.setViewportSize({width,height:900});await open(page,path);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${role} ${path} width ${width}`);}
   await page.setViewportSize({width:1280,height:900});
  });
 }
 const employee=contexts.employee.pages()[0],manager=contexts.manager.pages()[0],admin=contexts.super_admin.pages()[0],referrer=contexts.referrer.pages()[0];
 await checks('employee own scope, pending priority, read-only profile and denied edit',async()=>{
  await open(employee,'/dashboard');assert.equal(await employee.getByRole('link',{name:'Other Farmer',exact:true}).count(),0);
  assert.ok((await employee.locator('#pending-work').boundingBox()).y<(await employee.locator('#my-farmers').boundingBox()).y);
  await employee.getByRole('link',{name:'Role Farmer',exact:true}).click();await employee.getByText('This profile is read only.').waitFor();assert.equal(await employee.getByRole('button',{name:'Save changes'}).count(),0);
  await denied(employee,'/api/farmers/'+fixture.farmer,'PATCH',{name:'Unauthorized Name'});
  await open(employee,'/dashboard/farmers/'+fixture.otherFarmer);await employee.getByRole('heading',{name:'Farmer record unavailable'}).waitFor();
 });
 await checks('referrer own activity and copy feedback',async()=>{await open(referrer,'/dashboard');assert.ok(await referrer.locator('#my-referrals').count());assert.equal(await referrer.locator('#my-farmers').count(),0);await contexts.referrer.grantPermissions(['clipboard-read','clipboard-write']);await referrer.getByRole('button',{name:'रेफरल लिंक कॉपी करा'}).click();await referrer.getByRole('status').filter({hasText:'Referral link copied.'}).waitFor();});
 await checks('manager detail retains filters through tabs and profile return',async()=>{
  await open(manager,'/dashboard/admin?section=registrations&q=Role&status=completed&sort=name');await manager.getByRole('link',{name:'Role Farmer',exact:true}).click();await manager.getByRole('link',{name:'Payments',exact:true}).click();assert.ok((await manager.getByRole('link',{name:'Back to registrations'}).getAttribute('href')).includes('q=Role'));
  await manager.getByRole('link',{name:'Edit farmer profile',exact:true}).click();const name=manager.locator('[name=name]');await name.fill('Role Farmer Updated');await manager.getByRole('button',{name:'Save changes'}).click();await manager.getByRole('status').filter({hasText:'Farmer profile saved'}).waitFor();await manager.getByRole('link',{name:'Back to registrations'}).click();await manager.getByRole('link',{name:'Role Farmer Updated',exact:true}).waitFor();assert.equal(new URL(manager.url()).searchParams.get('q'),'Role');
 });
 await checks('manager grant validates fields and employee receives scoped edit only',async()=>{
  await open(manager,'/dashboard/admin/new/grant');const lookups=manager.locator('.lookup');await lookups.nth(0).locator('input').fill('Role Employee');await lookups.nth(0).getByRole('button',{name:'Search',exact:true}).click();await lookups.nth(0).locator('select option').nth(1).waitFor({state:'attached'});await lookups.nth(0).locator('select').selectOption({index:1});await lookups.nth(1).locator('input').fill('Role Farmer');await lookups.nth(1).getByRole('button',{name:'Search',exact:true}).click();await lookups.nth(1).locator('select option').nth(1).waitFor({state:'attached'});await lookups.nth(1).locator('select').selectOption({index:1});await manager.locator('[name=reason]').fill('Role UI test correction');await manager.getByRole('button',{name:'Grant edit access',exact:true}).click();assert.equal(await manager.locator('input[name=fields]').first().evaluate(el=>el.validationMessage),'Select at least one field this employee may edit.');await manager.locator('input[name=fields][value=name]').check();await manager.getByRole('button',{name:'Grant edit access',exact:true}).click();await manager.getByRole('status').filter({hasText:'Temporary edit access granted.'}).waitFor();
  await open(employee,'/dashboard/farmers/'+fixture.farmer);assert.equal(await employee.locator('[name=name]').isEnabled(),true);assert.equal(await employee.locator('[name=date_of_birth]').isDisabled(),true);await employee.locator('[name=name]').fill('Role Farmer Granted');await employee.getByRole('button',{name:'Save changes'}).click();await employee.getByRole('status').filter({hasText:'Farmer profile saved'}).waitFor();await denied(employee,'/api/farmers/'+fixture.farmer,'PATCH',{date_of_birth:'1991-01-01'});
 });
 await checks('manager payout confirmation records real isolated ledger entry',async()=>{
  await open(manager,'/dashboard/admin/new/payout');await manager.locator('.lookup input').fill('Role Referrer');await manager.locator('.lookup').getByRole('button',{name:'Search',exact:true}).click();await manager.locator('.lookup select option').nth(1).waitFor({state:'attached'});await manager.locator('.lookup select').selectOption({index:1});await manager.locator('[name=amountRupees]').fill('0.10');await manager.locator('[name=reference]').fill('ROLE-UI-PAYOUT');await manager.locator('input[type=checkbox]').check();manager.once('dialog',dialog=>dialog.accept());await manager.getByRole('button',{name:'Record completed payout'}).click();await manager.getByRole('status').filter({hasText:'Completed payout recorded.'}).waitFor();assert.equal(sql("select count(*) from public.referral_payouts where payment_reference='ROLE-UI-PAYOUT'"),'1');
 });
 await checks('task cancel returns to list from direct URL',async()=>{await open(manager,'/dashboard/admin/new/grant');await manager.getByRole('button',{name:'Cancel',exact:true}).click();await manager.waitForURL(url=>url.searchParams.get('section')==='grants');});
 await checks('super admin protected account hidden and single staff dialog names target',async()=>{
  await open(admin,'/dashboard/admin?section=staff');const protectedRow=admin.getByRole('row').filter({hasText:'Role Super Administrator'});assert.equal(await protectedRow.getByRole('button').count(),0);assert.equal(await protectedRow.getByRole('checkbox').count(),0);
  const row=admin.getByRole('row').filter({hasText:'Other Employee'});await row.getByRole('button',{name:'Deactivate',exact:true}).click();const dialog=admin.getByRole('dialog');assert.ok((await dialog.getAttribute('aria-labelledby')));await dialog.getByRole('heading',{name:'Deactivate — Other Employee'}).waitFor();await admin.keyboard.press('Escape');assert.equal(await dialog.isVisible(),false);assert.equal(await row.getByRole('button',{name:'Deactivate',exact:true}).evaluate(el=>el===document.activeElement),true);
 });
 await checks('bulk Trash success survives refresh and restore',async()=>{
  await open(admin,'/dashboard/admin?section=registrations&q=Role');await admin.getByRole('checkbox',{name:'Select Role Farmer Granted',exact:true}).check();await admin.getByRole('button',{name:'Move to Trash',exact:true}).click();let dialog=admin.getByRole('dialog');await dialog.locator('textarea').fill('Role UI regression');await dialog.getByRole('button',{name:'Confirm move to trash',exact:true}).click();await admin.getByRole('status').filter({hasText:'1 record moved to Trash.'}).waitFor();await admin.getByRole('link',{name:'Role Farmer Granted',exact:true}).waitFor({state:'detached'});assert.equal(await admin.getByRole('status').filter({hasText:'1 record moved to Trash.'}).isVisible(),true);
  await open(admin,'/dashboard/admin?section=trash');await admin.getByRole('checkbox',{name:'Select Role Farmer Granted',exact:true}).check();await admin.getByRole('button',{name:'Restore',exact:true}).click();dialog=admin.getByRole('dialog');await dialog.getByRole('button',{name:'Confirm restore',exact:true}).click();await admin.getByRole('status').filter({hasText:'1 record restored.'}).waitFor();
 });
 await checks('mobile menu keyboard, active payment route and screenshot',async()=>{
  await admin.setViewportSize({width:390,height:844});await open(admin,'/dashboard/admin/payments/'+fixture.registration);const toggle=admin.getByRole('button',{name:'Workspace menu'});await toggle.click();await admin.getByRole('navigation',{name:'Admin navigation'}).getByRole('link',{name:'Payment exceptions',exact:true}).focus();await admin.keyboard.press('Escape');assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert.equal(await toggle.evaluate(el=>el===document.activeElement),true);await toggle.click();assert.equal(await admin.getByRole('navigation',{name:'Admin navigation'}).getByRole('link',{name:'Payment exceptions',exact:true}).getAttribute('aria-current'),'page');await toggle.click();await admin.screenshot({path:'.audit/role-ui-results/mobile-payment.png',fullPage:true});
 });
 await checks('server authorization is also enforced by database RPCs',async()=>{
  const expected=sql("do $$ begin begin perform public.get_admin_workspace('41000000-0000-4000-8000-000000000004');raise exception 'Referrer unexpectedly allowed'; exception when others then if sqlerrm<>'Not authorized' then raise;end if;end;begin perform public.get_admin_workspace('41000000-0000-4000-8000-000000000003');raise exception 'Employee unexpectedly allowed';exception when others then if sqlerrm<>'Not authorized' then raise;end if;end;begin perform public.get_admin_workspace('41000000-0000-4000-8000-000000000002','trash');raise exception 'Manager unexpectedly allowed';exception when others then if sqlerrm<>'Not authorized' then raise;end if;end;end $$");assert.equal(expected,'DO');
 });
 assert.deepEqual(errors,[]);console.log('Role UI checks completed: '+results.length);
}finally{writeFileSync('.audit/role-ui-results/results.json',JSON.stringify({checks:results,pageErrors:errors},null,2));await browser.close();}
