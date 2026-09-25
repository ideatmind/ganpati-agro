import Link from 'next/link';
import {MEMBERSHIP_LABELS} from '@/features/registration/membership';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {requireIdentity} from '@/server/session';
import {callRpc} from '@/server/database';
import {formatRupees} from '@/shared/constants';
import type {RegistrationDetail} from '@/features/admin/schema';
import {AdminAction} from '@/components/AdminAction';
import {AdminPageHeading} from '@/components/AdminPageHeading';
import {StatusBadge} from '@/components/StatusBadge';
import {adminReturnPath} from '@/features/admin/return-path';
export default async function FinancialRecord({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{returnTo?:string}>}){
 const actor=await requireIdentity(['manager','super_admin']);const id=z.uuid().safeParse((await params).id);if(!id.success)notFound();
 const data=await callRpc<RegistrationDetail|null>('get_admin_registration',{p_actor_id:actor.id,p_registration_id:id.data});if(!data)notFound();
 const back=adminReturnPath((await searchParams).returnTo,'exceptions',actor.roles.includes('super_admin'));
 return <><Link className="admin-back" href={back}>← Back to payment exceptions</Link><AdminPageHeading title="Payment history" context={`Registration / ${data.reference}`} description={`${data.name} · ${MEMBERSHIP_LABELS[data.membershipType]} · ${formatRupees(data.amountPaise)}`}>{data.receiptToken&&<Link className="admin-button admin-button-secondary" href={'/receipt/'+data.receiptToken}>Open original receipt</Link>}</AdminPageHeading><p className="admin-alert">Financial history remains available after personal profile deletion.</p><section className="admin-record-panel"><header><h2>Provider payment history</h2><p>Check an existing payment against Razorpay.</p></header><div className="admin-payment-card"><AdminAction label="Check provider status" endpoint="/api/admin/reconcile" method="POST" body={{registrationId:id.data}}/></div>{data.orders.length?data.orders.map(order=><article className="admin-payment-card" key={order.id}><h3>{order.providerOrderId}</h3><p><StatusBadge value={order.status}/> · {formatRupees(order.amountPaise)}</p>{order.payments.length?order.payments.map(payment=><p key={payment.paymentId}>{payment.paymentId} · <StatusBadge value={payment.status}/> · {formatRupees(payment.amountPaise)}</p>):<p>No verified captured payment recorded yet.</p>}</article>):<p className="admin-payment-card">No bound provider order. Reconcile the registration reference with Razorpay support before attempting any replacement.</p>}</section></>;
}
