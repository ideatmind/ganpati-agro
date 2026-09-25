"use client";

import {digitPaste,digitBeforeInput} from "@/shared/digit-input";
import { useRef,useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PasswordToggle } from "./PasswordToggle";
import { requestJson } from "@/shared/request";

export function LoginForm({next="/dashboard"}:{next?:string}) {
  const router = useRouter();const running=useRef(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword,setShowPassword]=useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running.current) return;running.current=true;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await requestJson("/api/auth/login", Object.fromEntries(form));
      router.push(next);
      router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Login failed"); }
    finally { running.current=false;setBusy(false); }
  }

  return <form className="login-card" onSubmit={submit}>
    <div><span className="eyebrow">सुरक्षित लॉग इन</span><h1>आपल्या खात्यात प्रवेश करा</h1><p>Mobile number and password</p></div>
    <label>मोबाइल क्रमांक<input name="mobile" onPaste={digitPaste} onBeforeInput={digitBeforeInput} inputMode="numeric" autoComplete="username" pattern="[0-9]{10}" minLength={10} maxLength={10} title="Enter exactly 10 digits; no spaces or country code." required /></label>
    <div><label htmlFor="login-password">पासवर्ड / Password</label><div className="password-control"><input id="login-password" name="password" type={showPassword?"text":"password"} autoComplete="current-password" maxLength={72} minLength={8} required /><PasswordToggle visible={showPassword} onToggle={()=>setShowPassword(value=>!value)} inputId="login-password"/></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button" disabled={busy}>{busy ? "कृपया थांबा…" : "लॉग इन करा"}</button>
    <p className="fine-print">नोंदणीचे पेमेंट यशस्वी झाल्यानंतर खाते सक्रिय होते.</p>
  </form>;
}
