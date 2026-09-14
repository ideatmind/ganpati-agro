"use client";
declare global { interface Window { Razorpay?:new(options:Record<string,unknown>)=>{open():void;on(event:string,handler:()=>void):void} } }
let loading:Promise<void>|undefined;
export function loadCheckout(){
 if(window.Razorpay)return Promise.resolve();
 if(!loading)loading=new Promise<void>((resolve,reject)=>{
   const script=document.createElement('script');script.src='https://checkout.razorpay.com/v1/checkout.js';script.async=true;
   const timer=setTimeout(()=>fail(),12000);
   function fail(){clearTimeout(timer);script.remove();loading=undefined;reject(new Error('Secure checkout could not load. Reconnect and try opening it again.'));}
   script.onload=()=>{clearTimeout(timer);if(window.Razorpay)resolve();else fail();};script.onerror=fail;document.head.append(script);
 });
 return loading;
}
