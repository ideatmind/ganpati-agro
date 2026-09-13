"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { formatRupees } from "@/shared/constants";

interface Employee { id:string; displayName:string; mobile:string; status:string; onboardedFarmers:number; referralCode:string }
interface Referrer { profileId:string; displayName:string; mobile:string; referralCode:string; earnedPaise:number; paidPaise:number }
interface Farmer { id:string; name:string; reference:string; mobileMasked:string; employeeName?:string }

export function AdminConsole({ employees,referrers,farmers,canCreateStaff }:{ employees:Employee[];referrers:Referrer[];farmers:Farmer[];canCreateStaff:boolean }) {
  const router=useRouter(); const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>,endpoint:string,transform?:(form:FormData)=>unknown) {
    event.preventDefault(); setBusy(true); setMessage(""); const form=new FormData(event.currentTarget);
    const body=transform?transform(form):Object.fromEntries(form);
    const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const result=await response.json() as {error?:string}; setBusy(false);
    if(!response.ok){setMessage(result.error||"Operation failed");return;} setMessage("Saved successfully"); event.currentTarget.reset(); router.refresh();
  }
  return <div className="admin-console">{message&&<p className="status-message" role="status">{message}</p>}
    <div className="dashboard-columns">
      {canCreateStaff&&<form className="panel operation-form" onSubmit={(event)=>void submit(event,"/api/admin/staff")}><div className="panel-head"><h2>Create staff account</h2></div><label>Name<input name="name" required /></label><label>Mobile<input name="mobile" pattern="[0-9]{10}" maxLength={10} required /></label><label>Temporary password<input name="password" type="password" minLength={8} required /></label><label>Role<select name="role"><option value="employee">Employee</option><option value="manager">Manager</option></select></label><button className="button" disabled={busy}>Create account</button></form>}
      <form className="panel operation-form" onSubmit={(event)=>void submit(event,"/api/admin/payouts")}><div className="panel-head"><h2>Record offline payout</h2></div><label>Referrer<select name="profileId" required defaultValue=""><option value="">Select</option>{referrers.map((r)=><option key={r.profileId} value={r.profileId}>{r.displayName} · {r.referralCode} · {formatRupees(r.earnedPaise-r.paidPaise)}</option>)}</select></label><label>Amount (₹)<input name="amountRupees" type="number" min="1" step="0.01" required /></label><label>Method<select name="method"><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank_transfer">Bank transfer</option><option value="other">Other</option></select></label><label>Reference<input name="reference" /></label><label>Note<input name="note" /></label><button className="button" disabled={busy}>Record payout</button></form>
    </div>
    <form className="panel operation-form" onSubmit={(event)=>void submit(event,"/api/admin/grants",(form)=>({employeeId:form.get("employeeId"),farmerId:form.get("farmerId"),reason:form.get("reason"),durationHours:form.get("durationHours"),fields:form.getAll("fields")}))}><div className="panel-head"><h2>Temporary farmer edit access</h2><span>Maximum 7 days</span></div><div className="field-grid"><label>Employee<select name="employeeId" required defaultValue=""><option value="">Select</option>{employees.map((e)=><option value={e.id} key={e.id}>{e.displayName} · {e.mobile}</option>)}</select></label><label>Farmer<select name="farmerId" required defaultValue=""><option value="">Select</option>{farmers.map((f)=><option value={f.id} key={f.id}>{f.name} · {f.reference}</option>)}</select></label><label>Duration (hours)<input name="durationHours" type="number" defaultValue="4" min="1" max="168" required /></label><label>Reason<input name="reason" minLength={3} required /></label><fieldset className="wide checkbox-grid"><legend>Editable fields</legend>{[["name","Name"],["date_of_birth","Date of birth"],["village","Village"],["district","District"],["taluka","Taluka"],["income_source","Income source"],["cluster_type","Cluster type"]].map(([value,label])=><label key={value}><input type="checkbox" name="fields" value={value} /> {label}</label>)}</fieldset></div><button className="button" disabled={busy}>Grant temporary access</button></form>
    <section className="panel"><div className="panel-head"><h2>Employee performance</h2><span>{employees.length} employees</span></div><div className="table-wrap"><table><thead><tr><th>Name</th><th>Mobile</th><th>Referral code</th><th>Onboarded</th><th>Status</th></tr></thead><tbody>{employees.map((e)=><tr key={e.id}><td>{e.displayName}</td><td>{e.mobile}</td><td>{e.referralCode}</td><td>{e.onboardedFarmers}</td><td>{e.status}</td></tr>)}</tbody></table></div></section>
  </div>;
}
