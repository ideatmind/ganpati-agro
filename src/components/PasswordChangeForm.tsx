"use client";
import {useRef,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {requestJson} from '@/shared/request';
export function PasswordChangeForm({expanded=false}:{expanded?:boolean}){
 const router=useRouter();const running=useRef(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(running.current)return;const form=event.currentTarget;const values=new FormData(form);setMessage('');
  if(values.get('newPassword')!==values.get('confirmPassword')){setMessage('New passwords do not match.');return;}
  running.current=true;setBusy(true);
  try{await requestJson('/api/auth/password',{currentPassword:values.get('currentPassword'),newPassword:values.get('newPassword')});form.reset();router.replace('/login?passwordChanged=1');router.refresh();}
  catch(error){setMessage(error instanceof Error?error.message:'Password change failed.');}
  finally{running.current=false;setBusy(false);}
 }
 const form=<form className={expanded?'admin-task-form':'operation-form'} onSubmit={submit}><section><h2>Change password</h2><p>Use at least 8 characters, up to 72 UTF-8 bytes. Changing your password signs out all sessions.</p><div className={expanded?'admin-form-grid':'field-grid'}><label>Current password<input name="currentPassword" type="password" autoComplete="current-password" required minLength={8} maxLength={72}/></label><label>New password<input name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={72}/></label><label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={72}/></label></div>{message&&<p className="form-error" role="alert">{message}</p>}</section><div className={expanded?'admin-form-footer':undefined}><button className={expanded?'admin-button':'button'} disabled={busy}>{busy?'Saving…':'Change password'}</button></div></form>;
 return expanded?form:<details className="panel"><summary>पासवर्ड बदला / Change password</summary>{form}</details>;
}
