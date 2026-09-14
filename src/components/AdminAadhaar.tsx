'use client';
import {useEffect,useRef,useState} from 'react';
import {requestJson} from '@/shared/request';
export function AdminAadhaar({registrationId,lastFour}:{registrationId:string;lastFour?:string}){
 const [value,setValue]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const running=useRef(false);
 useEffect(()=>{if(!value)return;const timer=setTimeout(()=>setValue(''),60000);const hide=()=>{if(document.hidden)setValue('');};document.addEventListener('visibilitychange',hide);return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',hide);};},[value]);
 async function reveal(){if(running.current)return;running.current=true;setBusy(true);setError('');try{const result=await requestJson<{data:{aadhaar:string}}>('/api/admin/aadhaar',{registrationId});setValue(result.data.aadhaar);}catch(e){setError(e instanceof Error?e.message:'Unable to open Aadhaar.');}finally{running.current=false;setBusy(false);}}
 return <div className="admin-aadhaar"><div><span className="admin-field-label">Aadhaar number</span><strong className="admin-sensitive-value">{value?value.replace(/(.{4})(?=.)/g,'$1 '):lastFour?'XXXX XXXX '+lastFour:'Not available'}</strong></div>{lastFour&&<button className="admin-button admin-button-secondary" type="button" disabled={busy} onClick={()=>value?setValue(''):void reveal()}>{busy?'Opening…':value?'Hide number':'Show Aadhaar'}</button>}<small>Super-admin access is recorded. The number hides after one minute or when you leave this tab.</small>{error&&<p className="admin-alert error" role="alert">{error}</p>}</div>;
}
