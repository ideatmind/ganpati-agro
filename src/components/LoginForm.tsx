"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form)),
    });
    const result = await response.json() as { error?: string };
    if (!response.ok) {
      setError(result.error || "Login failed");
      setBusy(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return <form className="login-card" onSubmit={submit}>
    <div><span className="eyebrow">सुरक्षित लॉग इन</span><h1>आपल्या खात्यात प्रवेश करा</h1><p>Mobile number and password</p></div>
    <label>मोबाइल क्रमांक<input name="mobile" inputMode="numeric" autoComplete="username" pattern="[0-9]{10}" maxLength={10} required /></label>
    <label>पासवर्ड<input name="password" type="password" autoComplete="current-password" minLength={8} required /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button" disabled={busy}>{busy ? "कृपया थांबा…" : "लॉग इन करा"}</button>
    <p className="fine-print">नोंदणीचे पेमेंट यशस्वी झाल्यानंतर खाते सक्रिय होते.</p>
  </form>;
}
