import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

export const requestTimings = new AsyncLocalStorage<{requestId:string; stages:{name:string; durationMs:number}[]}>();
export async function timed<T>(name:string,work:()=>Promise<T>):Promise<T>{
  const start=performance.now();let success=false;
  try{const value=await work();success=true;return value;}
  finally{
    const durationMs=Math.round(performance.now()-start);const context=requestTimings.getStore();
    context?.stages.push({name,durationMs});
    console.info(JSON.stringify({event:'operation_timing',requestId:context?.requestId,operation:name,durationMs,success}));
  }
}
