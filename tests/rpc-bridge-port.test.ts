import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import {once} from 'node:events';

test('simultaneous RPC bridges use distinct OS-assigned ports and advertise reachable endpoints',async(t)=>{
 const children:ChildProcess[]=[];
 t.after(async()=>{await Promise.all(children.map(async child=>{if(!child.pid||child.exitCode!==null||child.signalCode!==null)return;const closed=once(child,'close');child.kill();await closed;}));});
 function start(){return new Promise<number>((resolve,reject)=>{
  const child=spawn(process.execPath,['tests/support/rpc-bridge.mjs'],{env:{...process.env,TEST_DATABASE_URL:'postgresql://postgres@127.0.0.1:5432/unused',RPC_BRIDGE_PORT:'0'},windowsHide:true});children.push(child);let output='';
  const timer=setTimeout(()=>reject(Error('Bridge startup timed out: '+output)),10000);
  child.stdout.on('data',value=>{output+=value;const match=output.match(/Isolated RPC bridge ready on port (\d+)\r?\n/);if(match){clearTimeout(timer);resolve(Number(match[1]));}});
  child.stderr.on('data',value=>output+=value);
  child.on('error',error=>{clearTimeout(timer);reject(error);});child.on('exit',()=>{clearTimeout(timer);reject(Error(output));});
 });}
 const ports=await Promise.all([start(),start()]);assert.notEqual(ports[0],ports[1]);
 for(const port of ports){assert.ok(port>0);const response=await fetch(`http://127.0.0.1:${port}/rpc/no_database_access`);assert.equal(response.status,403);assert.deepEqual(await response.json(),{});}
});
