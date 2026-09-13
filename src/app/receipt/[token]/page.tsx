import Image from "next/image";
import { notFound } from "next/navigation";
import { PrintReceiptButton } from "@/components/PrintReceiptButton";
import { callRpc } from "@/server/database";
import { formatRupees } from "@/shared/constants";

interface Receipt { receiptNumber: string; registrationReference: string; membershipNumber: string; memberName: string; memberMobile: string; amountPaise: number; currency: string; paymentId: string; issuedAt: string }

export const metadata = { title: "Payment receipt" };

export default async function ReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();
  const receipt = await callRpc<Receipt | null>("get_receipt", { p_public_token: token });
  if (!receipt) notFound();
  return <main className="receipt-page"><div className="receipt-actions"><PrintReceiptButton /></div><article className="receipt-card">
    <header><Image src="/brand/logo-icon.png" width={68} height={68} alt="" /><div><h1>श्री गणपती ॲग्रो</h1><p>PRODUCER COMPANY LTD.</p></div><span className="paid-stamp">PAID</span></header>
    <div className="receipt-title"><span>पेमेंट पावती</span><h2>Payment Receipt</h2><p>{new Intl.DateTimeFormat("mr-IN", { dateStyle: "long", timeStyle: "short" }).format(new Date(receipt.issuedAt))}</p></div>
    <dl><div><dt>Receipt number</dt><dd>{receipt.receiptNumber}</dd></div><div><dt>Member</dt><dd>{receipt.memberName}</dd></div><div><dt>Mobile</dt><dd>{receipt.memberMobile}</dd></div><div><dt>Registration</dt><dd>{receipt.registrationReference}</dd></div><div><dt>Membership</dt><dd>{receipt.membershipNumber}</dd></div><div><dt>Razorpay payment</dt><dd>{receipt.paymentId}</dd></div></dl>
    <div className="receipt-total"><span>सभासदत्व शुल्क / Membership fee</span><strong>{formatRupees(receipt.amountPaise)}</strong></div>
    <footer><p>This receipt is generated on your device from a verified payment record. No customer refund is available after successful membership activation.</p><small>Growing Farmers. Building Futures.</small></footer>
  </article></main>;
}
