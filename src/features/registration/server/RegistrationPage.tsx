import 'server-only';
import Link from 'next/link';
import {getIdentity} from '@/server/session';
import {callRpc} from '@/server/database';
import {SiteHeader} from '@/components/SiteHeader';
import {RegistrationForm} from '@/components/RegistrationForm';
import {getCheckoutContext} from './checkout';
import {registrationFee} from './pricing';
import {MEMBERSHIP_LABELS,MEMBERSHIP_TYPES,membershipPath,type MembershipType,type MembershipFormProfile} from '../membership';
export async function RegistrationPage({type,searchParams}:{type:MembershipType;searchParams:Promise<{ref?:string|string[]}>}){
 const [query,identity,checkout]=await Promise.all([searchParams,getIdentity(),getCheckoutContext(type)]);
 const feePaise=await registrationFee(type);
 const referral=typeof query.ref==='string'&&/^[A-Za-z0-9]{6,16}$/.test(query.ref)?query.ref:'';
 const assisted=Boolean(identity?.roles.some(role=>['employee','manager','super_admin'].includes(role)));
 const profile=identity&&!assisted?await callRpc<MembershipFormProfile|null>('get_membership_form_profile',{p_actor_id:identity.id}):null;
 return <><SiteHeader registration/><main className="form-page legacy-form-page">
 {identity&&<div className="page-back"><Link href="/dashboard">← Back to dashboard</Link></div>}
 <nav className="membership-switch" aria-label="Choose membership form">{MEMBERSHIP_TYPES.map(item=><Link key={item} href={membershipPath(item)+(referral?'?ref='+encodeURIComponent(referral):'')} aria-current={item===type?'page':undefined}><strong>{item==='standard'?'Regular membership · ₹500':'Focused Value Chain · ₹2,500'}</strong><span>{item==='standard'?'नियमित सभासदत्व':'केंद्रित मूल्य साखळी सभासदत्व'}</span></Link>)}</nav>
 <div className="form-heading"><span className="eyebrow">{type==='standard'?'शेतकरी नोंदणी / Farmer registration':'केंद्रित मूल्य साखळी सभासदत्व'}</span><h1>{type==='standard'?'गणपती ॲग्रो सभासदत्व':'Focused Value Chain Membership Form'}</h1><p>{type==='standard'?'पूर्ण माहिती भरा आणि सभासदत्व सक्रिय करा.':'डाळिंब, आंबा, पेरू, पपई, कुक्कुटपालन व शेळी पालन / Pomegranate, mango, guava, papaya, poultry and goat farming.'}</p>{assisted&&<span className="status info">Employee-assisted onboarding</span>}</div>
 {!identity&&<p className="membership-help">आधीपासून सभासद आहात? / Already a member? <Link href={'/login?next='+encodeURIComponent(membershipPath(type)+(referral?'?ref='+encodeURIComponent(referral):''))}>Sign in to add this membership to your existing account.</Link></p>}
 {profile&&<p className="membership-help">Your existing account will be used for {MEMBERSHIP_LABELS[type]}. Personal details stay unchanged. Enter your current password and Aadhaar to confirm your identity.</p>}
 <RegistrationForm key={type} membershipType={type} profile={profile} feePaise={feePaise} initialReferral={referral} hasCheckout={Boolean(checkout)} today={new Date().toISOString().slice(0,10)}/>
 </main></>;
}
