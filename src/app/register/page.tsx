import { getIdentity } from "@/server/session";
import { SiteHeader } from "@/components/SiteHeader";
import { RegistrationForm } from "@/components/RegistrationForm";
import { getCheckoutContext } from "@/features/registration/server/checkout";
import {registrationFee} from '@/features/registration/server/pricing';
import Link from 'next/link';

export const metadata = { title: "Farmer registration" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ ref?: string | string[] }> }) {
  const [query, identity, checkout] = await Promise.all([searchParams, getIdentity(),getCheckoutContext()]);
  const feePaise=await registrationFee();
  const ref = typeof query.ref === "string" ? (/^[A-Za-z0-9]{6,16}$/.test(query.ref)?query.ref:"") : "";
  const assisted = Boolean(identity?.roles.some((role) => ["employee","manager","super_admin"].includes(role)));
  return <><SiteHeader registration /><main className="form-page legacy-form-page">{identity&&<div className="page-back"><Link href="/dashboard">← Back to dashboard</Link></div>}<div className="form-heading"><span className="eyebrow">शेतकरी नोंदणी / Farmer registration</span><h1>गणपती ॲग्रो सभासदत्व</h1><p>पूर्ण माहिती भरा आणि सभासदत्व सक्रिय करा.</p>{assisted && <span className="status info">Employee-assisted onboarding</span>}</div><RegistrationForm feePaise={feePaise} initialReferral={ref} assisted={assisted} hasCheckout={Boolean(checkout)} today={new Date().toISOString().slice(0,10)} /></main></>;
}
