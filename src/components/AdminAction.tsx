"use client";
import {useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {requestJson} from '@/shared/request';
export function AdminAction({label,endpoint,body,method='PATCH',confirmation}:{label:string;endpoint:string;body:Record<string,string>;method?:string;confirmation?:string}){
 const router=useRouter();const running=useRef(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 async function run(){if(running.current)return;if(confirmation&&!window.confirm(confirmation))return;running.current=true;setBusy(true);setMessage('');try{await requestJson(endpoint,body,method);setMessage(method==='POST'?'Provider status checked. Review the latest payment state.':'Saved.');router.refresh();}catch(e){setMessage(e instanceof Error?e.message:'Could not complete this action.');}finally{running.current=false;setBusy(false);}}
 return <div className="inline-action"><button type="button" className="button button-outline" disabled={busy} onClick={()=>void run()}>{busy?'Processing…':label}</button>{message&&<p role="status">{message}</p>}</div>;
}
