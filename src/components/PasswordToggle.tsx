"use client";

export function PasswordToggle({visible,onToggle,inputId}:{visible:boolean;onToggle:()=>void;inputId:string}){
  const name=inputId==='confirm-password'?'confirmation password':'password';
  return <button type="button" className="password-toggle" onClick={onToggle} aria-controls={inputId} aria-label={(visible?'Hide ':'Show ')+name} aria-pressed={visible}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{visible&&<path d="m3 3 18 18"/>}</svg></button>;
}
