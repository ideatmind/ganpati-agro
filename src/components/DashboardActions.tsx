"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@/shared/request";

export function DashboardActions({ referralUrl }: { referralUrl?: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function copy() {
    try { if(!referralUrl)return;await navigator.clipboard.writeText(referralUrl); setCopied(true); }
    catch { setError("Could not copy. Select and copy the referral link above."); }
  }
  async function logout() {
    if (busy) return;
    setBusy(true);setError("");
    try { await requestJson("/api/auth/logout"); router.push("/"); router.refresh(); }
    catch(error){setError(error instanceof Error?error.message:"Logout failed");}
    finally{setBusy(false);}
  }
  return <div className="dashboard-actions">{referralUrl&&<button className="button button-outline" onClick={copy}>{copied ? "लिंक कॉपी झाली" : "रेफरल लिंक कॉपी करा"}</button>}<button className="text-button" onClick={logout} disabled={busy}>लॉग आउट</button>{copied&&<span role="status">Referral link copied.</span>}{error&&<p role="alert">{error}</p>}</div>;
}
