import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardActions } from "@/components/DashboardActions";
import { PasswordChangeForm } from "@/components/PasswordChangeForm";
import { callRpc } from "@/server/database";
import { getIdentity } from "@/server/session";
import { formatRupees } from "@/shared/constants";

interface Earning { amountPaise: number; creditedAt: string; farmerName: string; reference: string }
interface Payout { amountPaise: number; method: string; reference?: string; paidAt: string }
interface Onboarding { farmerId:string; reference: string; farmerName: string; mobileMasked: string; paymentMode: string; completedAt: string }
interface DashboardData {
  roles: string[]; earnedPaise: number; paidPaise: number; availablePaise: number; referralCode: string | null;
  successfulReferrals: number; onboardedFarmers: number; cashPending: number; totalFarmers: number | null;
  recentEarnings: Earning[]; recentPayouts: Payout[]; recentOnboardings: Onboarding[];
}

function date(value: string) { return new Intl.DateTimeFormat("mr-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(value)); }

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const identity = await getIdentity();
  if (!identity) redirect("/login");
  const data = await callRpc<DashboardData>("get_dashboard", { p_account_id: identity.id });
  const isEmployee = identity.roles.some((role) => ["employee","manager","super_admin"].includes(role));
  const isOps = identity.roles.some((role) => ["manager","super_admin"].includes(role));
  const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const referralUrl = data.referralCode ? `${origin}/register?ref=${encodeURIComponent(data.referralCode)}` : undefined;

  return <main className="dashboard-shell">
    <header className="dashboard-header"><div><span className="eyebrow">नमस्कार</span><h1>{identity.displayName}</h1><p>{identity.roles.map(role=>role.replaceAll("_"," ")).join(" · ")}</p></div><DashboardActions referralUrl={referralUrl} /></header>
    {data.referralCode&&<section className="referral-strip"><div><span>आपला रेफरल कोड</span><strong>{data.referralCode}</strong><small>{referralUrl}</small></div><Link className="button button-gold" href={`/register?ref=${data.referralCode}`}>नवीन नोंदणी</Link></section>}
    <section className="metric-grid">
      {data.referralCode&&<><article><span>एकूण कमाई</span><strong>{formatRupees(data.earnedPaise)}</strong></article>
      <article><span>मिळालेली रक्कम</span><strong>{formatRupees(data.paidPaise)}</strong></article>
      <article><span>बाकी कमाई</span><strong>{formatRupees(data.availablePaise)}</strong></article>
      <article><span>यशस्वी रेफरल</span><strong>{data.successfulReferrals}</strong></article></>}
      {isEmployee && <article><span>Onboarded farmers</span><strong>{data.onboardedFarmers}</strong></article>}
      {isOps && <article><span>Total farmers</span><strong>{data.totalFarmers ?? 0}</strong></article>}
    </section>
    {data.referralCode&&<div className="dashboard-columns">
      <section className="panel"><div className="panel-head"><h2>रेफरल कमाई</h2><span>Latest 10</span></div>{data.recentEarnings.length ? <div className="table-wrap"><table><thead><tr><th>शेतकरी</th><th>नोंद</th><th>दिनांक</th><th>रक्कम</th></tr></thead><tbody>{data.recentEarnings.map((item)=><tr key={item.reference}><td>{item.farmerName}</td><td>{item.reference}</td><td>{date(item.creditedAt)}</td><td>{formatRupees(item.amountPaise)}</td></tr>)}</tbody></table></div> : <p className="empty">यशस्वी रेफरल झाल्यावर कमाई येथे दिसेल.</p>}</section>
      <section className="panel"><div className="panel-head"><h2>ऑफलाइन मिळालेली कमाई</h2><span>View only</span></div>{data.recentPayouts.length ? <div className="table-wrap"><table><thead><tr><th>दिनांक</th><th>पद्धत</th><th>रक्कम</th></tr></thead><tbody>{data.recentPayouts.map((item,index)=><tr key={`${item.paidAt}-${index}`}><td>{date(item.paidAt)}</td><td>{item.method}</td><td>{formatRupees(item.amountPaise)}</td></tr>)}</tbody></table></div> : <p className="empty">व्यवस्थापकाने offline payout नोंदवल्यावर येथे दिसेल.</p>}</section>
    </div>}
      {isEmployee && <section className="panel"><div className="panel-head"><h2>मी नोंदणी केलेले शेतकरी</h2><Link href="/register">नवीन जोडा</Link></div>{data.recentOnboardings.length ? <div className="table-wrap"><table><thead><tr><th>शेतकरी</th><th>मोबाइल</th><th>नोंद</th><th>पेमेंट</th><th>दिनांक</th></tr></thead><tbody>{data.recentOnboardings.map((item)=><tr key={item.reference}><td><Link className="table-link" href={`/dashboard/farmers/${item.farmerId}`}>{item.farmerName}</Link></td><td>{item.mobileMasked}</td><td>{item.reference}</td><td>{item.paymentMode === "employee_cash_assisted" ? "Cash collected" : "Farmer online"}</td><td>{date(item.completedAt)}</td></tr>)}</tbody></table></div> : <p className="empty">अजून कोणतीही यशस्वी नोंदणी नाही.</p>}</section>}
    {isOps && <section className="admin-callout"><div><span className="eyebrow light">Admin operations</span><h2>व्यवस्थापन नियंत्रण</h2><p>Staff accounts, offline payout records and temporary edit grants are restricted to manager and super admin roles.</p></div><Link className="button button-gold" href="/dashboard/admin">Open admin console</Link></section>}
    <PasswordChangeForm />
  </main>;
}
