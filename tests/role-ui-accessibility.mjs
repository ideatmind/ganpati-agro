import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.TEST_APP_URL;const database=process.env.TEST_DATABASE_URL;
if(!base||!database||![base,database].every(value=>['localhost','127.0.0.1'].includes(new URL(value).hostname)))throw Error('Use isolated loopback services.');
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE}:{})});
const staffName='Created Employee '+crypto.randomUUID().replace(/[^a-f]/g,'').slice(0,8);
const page=await browser.newPage({viewport:{width:390,height:844}});const results=[];const contrast=[];const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
try{
 await page.goto(base+'/login');await page.locator('[name=mobile]').fill('6800000001');await page.locator('[name=password]').fill('role test password');await page.locator('form .button').last().click();await page.waitForURL('**/dashboard/admin');
 for(const path of ['/dashboard/admin','/dashboard/admin?section=registrations','/dashboard/admin?section=staff','/dashboard/admin?section=referrers','/dashboard/admin?section=payouts','/dashboard/admin?section=grants','/dashboard/admin?section=exceptions','/dashboard/admin?section=audit','/dashboard/admin?section=trash','/dashboard/admin/new/staff','/dashboard/admin/new/payout','/dashboard/admin/new/grant','/dashboard/admin/account']){
  await page.goto(base+path);await page.locator('.admin-page-heading h1').filter({hasNotText:/^Loading/}).waitFor();await page.evaluate(()=>document.fonts.ready);
  const failures=await page.evaluate(()=>{
   const rgb=s=>{const a=s.match(/[\d.]+/g)?.map(Number);return a&&a.length>=3?[a[0]/255,a[1]/255,a[2]/255,a[3]??1]:null;};
   const lum=c=>c.slice(0,3).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
   const failures=[];
   for(const el of document.querySelectorAll('label,small,p,button,legend,span,a,h1,h2,h3,td,th,dt,dd,summary')){
    if(![...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())||!el.getClientRects().length||el.closest('[disabled],.is-disabled,[aria-hidden=true]'))continue;
    const style=getComputedStyle(el);if(style.visibility==='hidden'||style.display==='none')continue;const fg=rgb(style.color);if(!fg||fg[3]!==1)continue;
    let parent=el,bg=null,unknown=false;while(parent){const st=getComputedStyle(parent);if(st.backgroundImage!=='none'||Number(st.opacity)<1){unknown=true;break;}const c=rgb(st.backgroundColor);if(c&&c[3]===1){bg=c;break;}parent=parent.parentElement;}if(unknown)continue;bg??=[1,1,1,1];
    const a=lum(fg),b=lum(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);const size=parseFloat(style.fontSize);const target=size>=24||(size>=18.66&&parseInt(style.fontWeight)>=700)?3:4.5;
    if(ratio+.02<target)failures.push({text:el.textContent.trim().slice(0,70),ratio:Math.round(ratio*100)/100,target,color:style.color});
   }return failures;
  });contrast.push({path,failures});
 }
 results.push('Solid-color text contrast inspected on 13 mobile admin pages; excludes gradients/images/transparency.');
 await page.goto(base+'/dashboard/admin/new/staff');await page.locator('[name=name]').fill(staffName);await page.locator('[name=mobile]').fill('69'+String(Date.now()).slice(-8));await page.locator('[name=password]').fill('created employee password');
 await page.route('**/api/admin/staff',route=>route.abort('internetdisconnected'));await page.getByRole('button',{name:'Create team member'}).click();await page.getByRole('alert').filter({hasText:'Connection lost'}).waitFor();assert.equal(await page.locator('[name=name]').inputValue(),staffName);assert.equal(await page.getByRole('button',{name:'Create team member'}).isEnabled(),true);await page.unroute('**/api/admin/staff');
 await page.getByRole('button',{name:'Create team member'}).click();await page.getByRole('status').filter({hasText:'Team member created.'}).waitFor();results.push('Staff network failure retains inputs; subsequent real creation succeeds.');
 const row=page.getByRole('row').filter({hasText:staffName});await row.getByRole('button',{name:'Deactivate',exact:true}).click();const dialog=page.getByRole('dialog');const first=dialog.locator('button').first(),last=dialog.locator('button').last();await last.focus();await page.keyboard.press('Tab');await first.waitFor();assert.equal(await first.evaluate(el=>el===document.activeElement),true);await first.focus();await page.keyboard.press('Shift+Tab');assert.equal(await last.evaluate(el=>el===document.activeElement),true);await last.click();await page.getByRole('status').filter({hasText:'1 record deactivated.'}).first().waitFor();await row.getByRole('button',{name:'Activate',exact:true}).waitFor();results.push('Native dialog traps focus; staff deactivation persists and announces success.');
 await page.setViewportSize({width:1280,height:900});await page.goto(base+'/dashboard/admin');await page.getByRole('heading',{name:'Overview',exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:'.audit/role-ui-results/desktop-overview.png',fullPage:true});
 await page.goto(base+'/register');await page.getByRole('link',{name:'Back to dashboard'}).waitFor();await page.getByRole('link',{name:'Back to dashboard'}).click();await page.waitForURL('**/dashboard/admin');results.push('Signed-in registration returns to role dashboard.');
 const r=spawnSync(process.env.PSQL_PATH||'psql',['-X','-At','-d',database,'-c',"select public_token from public.receipts order by issued_at limit 1"],{encoding:'utf8',windowsHide:true});if(r.status)throw Error(r.stderr);await page.goto(base+'/receipt/'+r.stdout.trim());await page.getByRole('link',{name:'My dashboard'}).waitFor();assert.equal(await page.getByRole('link',{name:'Website',exact:true}).count(),1);results.push('Receipt provides dashboard and website exits.');
 assert.deepEqual(pageErrors,[]);assert.deepEqual(contrast.filter(row=>row.failures.length),[]);
 console.log(JSON.stringify({results,contrastFailures:contrast.filter(row=>row.failures.length)},null,2));
}finally{writeFileSync('.audit/role-ui-results/accessibility.json',JSON.stringify({results,contrast,pageErrors},null,2));await browser.close();}
