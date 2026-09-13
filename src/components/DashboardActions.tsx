"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DashboardActions({ referralUrl }: { referralUrl: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  return <div className="dashboard-actions"><button className="button button-outline" onClick={copy}>{copied ? "लिंक कॉपी झाली" : "रेफरल लिंक कॉपी करा"}</button><button className="text-button" onClick={logout}>लॉग आउट</button></div>;
}
