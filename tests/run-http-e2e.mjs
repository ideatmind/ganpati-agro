import {spawn,spawnSync} from 'node:child_process';
const database=process.env.TEST_DATABASE_URL;
if(!database||!['localhost','127.0.0.1','[::1]'].includes(new URL(database).hostname))throw Error('Set a loopback TEST_DATABASE_URL pointing to an isolated migrated test database.');
const env={...process.env,SUPABASE_URL:'http://127.0.0.1:'+(process.env.RPC_BRIDGE_PORT||55434),SUPABASE_SECRET_KEY:'isolated-test-key',SESSION_SECRET:'isolated-test-session-secret-more-than-32-characters',PII_ENCRYPTION_KEY:'1'.repeat(64),RAZORPAY_KEY_ID:'rzp_live_isolated',RAZORPAY_KEY_SECRET:'isolated-payment-secret',RAZORPAY_WEBHOOK_SECRET:'isolated-webhook-secret',RAZORPAY_LIVE_WEBHOOK_SECRET:'isolated-webhook-secret',NEXT_PUBLIC_APP_URL:'http://localhost:3101',TRUSTED_CLIENT_IP_HEADER:'x-test-client-ip',TEST_APP_URL:'http://localhost:3101'};
env.APP_ORIGIN='http://localhost:3101';
env.VERCEL_ENV='production';
const children=[];
async function start(args,ready){return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,args,{env,windowsHide:true});children.push(child);let output='';
  const timer=setTimeout(()=>reject(Error('Isolated service startup timed out')),20000);
  child.stdout.on('data',value=>{output+=value;if(output.includes(ready)){clearTimeout(timer);resolve(child);}});
  child.stderr.on('data',value=>output+=value);
  child.on('error',error=>{clearTimeout(timer);reject(error);});
  child.on('exit',code=>{clearTimeout(timer);if(code)reject(Error('Isolated service failed: '+output));});
});}
try{
  if(!process.env.PERF_LABEL){const fixture=spawnSync(env.PSQL_PATH||'psql',['-X','-q','-v','ON_ERROR_STOP=1','-f','tests/support/admin-http.sql','--dbname',database],{stdio:'inherit',windowsHide:true});if(fixture.status)throw Error('Isolated admin fixture failed');}
  await start(['tests/support/rpc-bridge.mjs'],'Isolated RPC bridge ready');
  await start(['--import','./tests/support/provider-stub.mjs','node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','3101'],'Ready');
  await new Promise((resolve,reject)=>{const test=spawn(process.execPath,[process.env.PERF_LABEL?'tests/performance-http.mjs':'tests/e2e-http.mjs'],{env,stdio:'inherit',windowsHide:true});test.on('error',reject);test.on('exit',code=>code?reject(Error('HTTP regression failed')):resolve());});
}finally{for(const child of children.reverse())child.kill();}
