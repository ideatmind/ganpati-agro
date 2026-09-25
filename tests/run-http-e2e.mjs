import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
const database=process.env.TEST_DATABASE_URL;
if(!database||!['localhost','127.0.0.1','[::1]'].includes(new URL(database).hostname))throw Error('Set a loopback TEST_DATABASE_URL pointing to an isolated migrated test database.');
const env={...process.env,RPC_BRIDGE_PORT:process.env.RPC_BRIDGE_PORT??'0',SUPABASE_URL:'http://127.0.0.1',SUPABASE_SECRET_KEY:'isolated-test-key',SESSION_SECRET:'isolated-test-session-secret-more-than-32-characters',PII_ENCRYPTION_KEY:'1'.repeat(64),RAZORPAY_KEY_ID:'rzp_live_isolated',RAZORPAY_KEY_SECRET:'isolated-payment-secret',RAZORPAY_WEBHOOK_SECRET:'isolated-webhook-secret',RAZORPAY_LIVE_WEBHOOK_SECRET:'',RAZORPAY_WEBHOOK_MODE:'live',NEXT_PUBLIC_APP_URL:'http://localhost:3101',TRUSTED_CLIENT_IP_HEADER:'x-test-client-ip',TEST_APP_URL:'http://localhost:3101'};
env.APP_ORIGIN='http://localhost:3101';
env.VERCEL_ENV='production';
const children=[];
async function start(args,ready){return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,args,{env,windowsHide:true});children.push(child);let output='';
  const timer=setTimeout(()=>reject(Error('Isolated service startup timed out: '+output)),20000);
  child.stdout.on('data',value=>{output+=value;const match=output.match(ready);if(match){clearTimeout(timer);resolve(match);}});
  child.stderr.on('data',value=>output+=value);
  child.on('error',error=>{clearTimeout(timer);reject(error);});
  child.on('exit',code=>{clearTimeout(timer);reject(Error('Isolated service exited ('+code+'): '+output));});
});}
try{
  if(!process.env.PERF_LABEL){const fixture=spawnSync(env.PSQL_PATH||'psql',['-X','-q','-v','ON_ERROR_STOP=1','-f','tests/support/admin-http.sql','--dbname',database],{stdio:'inherit',windowsHide:true});if(fixture.status)throw Error('Isolated admin fixture failed');}
  const bridge=await start(['tests/support/rpc-bridge.mjs'],/Isolated RPC bridge ready on port (\d+)\r?\n/);
  env.SUPABASE_URL='http://127.0.0.1:'+bridge[1];
  console.log('Using isolated RPC bridge at '+env.SUPABASE_URL);
  await start(['--import','./tests/support/provider-stub.mjs','node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','3101'],'Ready');
  for(const script of process.env.PERF_LABEL?['tests/performance-http.mjs']:process.env.MEMBERSHIP_BROWSER_ONLY?['tests/focused-membership-http.mjs','tests/focused-membership-browser.mjs']:['tests/e2e-http.mjs','tests/focused-membership-http.mjs'])await new Promise((resolve,reject)=>{const test=spawn(process.execPath,[script],{env,stdio:'inherit',windowsHide:true});test.on('error',reject);test.on('exit',code=>code?reject(Error('HTTP regression failed')):resolve());});
}finally{for(const child of children.reverse()){
  if(!child.pid||child.exitCode!==null||child.signalCode!==null)continue;
  const exited=once(child,'exit');child.kill();
  const timer=setTimeout(()=>child.kill('SIGKILL'),5000);timer.unref();
  try{await exited;}finally{clearTimeout(timer);}
}}
