import "server-only";
import { callRpc } from "@/server/database";
import { createRazorpayOrder, fetchOrderPayments, fetchPayment, verifyCheckoutSignature } from "@/server/razorpay";
import { AppError } from "@/shared/errors";
import { isMatchingCapture, type ProviderPayment } from "@/features/payments/schema";
import { isPaymentDemo, requiredEnv } from "@/server/env";
import { rateLimitKey } from "@/server/rate-limit";

export interface Checkout { id: string; reference: string; amountPaise: number; status: string; providerOrderId: string | null; receiptToken: string | null }
interface Finalized { receiptToken?: string; paymentException?: boolean }
export async function checkoutStatus(id: string,limit?:{operation:string;count:number}) {
  const data = await callRpc<Checkout | null>(limit?'get_limited_checkout':'get_checkout', { p_registration_id: id,...(limit?{p_rate_key:rateLimitKey(limit.operation+':'+id),p_limit:limit.count}:{}) });
  if (!data) throw new AppError(404, "CHECKOUT_NOT_FOUND", "Registration could not be found.");
  return data;
}
export async function startOrder(id: string) {
  const keyId=isPaymentDemo()?"":requiredEnv("RAZORPAY_KEY_ID");
  if(process.env.VERCEL_ENV==='production'&&keyId.startsWith('rzp_test_'))throw new AppError(503,'PAYMENTS_UNAVAILABLE','Online payments are not available yet. Your registration is saved.');
  if(!isPaymentDemo()){
    const secret=requiredEnv("RAZORPAY_KEY_SECRET");
    if(!/^rzp_(test|live)_/.test(keyId)||/replace|placeholder/i.test(keyId+secret)) throw new AppError(503,"PAYMENTS_UNAVAILABLE","Payments are not configured yet. Your registration is saved.");
  }
  const prepared = await callRpc<{ pending?: boolean; receiptToken?: string; providerOrderId?: string; amountPaise: number; reference: string; requestKey?: string }>("prepare_checkout", { p_registration_id: id,p_rate_key:rateLimitKey('order:'+id) });
  if (prepared.receiptToken) return prepared;
  if (prepared.pending) throw new AppError(409, "ORDER_PENDING", "The previous checkout request is still being checked. Do not pay again. Contact support if this continues.");
  if (prepared.providerOrderId) return { ...prepared, keyId, demo: prepared.providerOrderId.startsWith("demo_order_") };
  if (!prepared.requestKey) throw new Error("Invalid checkout reservation");
  const order = await createRazorpayOrder(prepared.amountPaise, prepared.reference);
  if (order.amount !== prepared.amountPaise || order.currency !== "INR") throw new Error("Provider order mismatch");
  const recorded = await callRpc("record_payment_order", { p_registration_id: id, p_provider_order_id: order.id, p_idempotency_key: prepared.requestKey });
  return { ...(recorded as object), keyId, demo: order.id.startsWith("demo_order_") };
}
async function finalize(checkout: Checkout, payment: ProviderPayment) {
  if (!checkout.providerOrderId || !isMatchingCapture(payment, checkout.providerOrderId, checkout.amountPaise)) throw new AppError(409, "PAYMENT_PENDING", "Verifying your payment… Please check the status again. Do not pay again.");
  const data = await callRpc<Finalized>("finalize_registration_payment", { p_provider_order_id: checkout.providerOrderId, p_provider_payment_id: payment.id, p_amount_paise: payment.amount, p_currency: payment.currency, p_payer_kind: "farmer", p_signature_verified: true });
  if (data.paymentException) throw new AppError(409, "PAYMENT_REVIEW", "An additional payment requires review. Please contact support and do not pay again.");
  return data;
}
export async function verifyPayment(id: string, body: { orderId: string; paymentId: string; signature: string }) {
  const checkout = await checkoutStatus(id,{operation:'verify',count:20});
  if (body.orderId !== checkout.providerOrderId || !verifyCheckoutSignature(checkout.providerOrderId, body.paymentId, body.signature)) throw new AppError(400, "INVALID_SIGNATURE", "Payment verification failed.");
  const payment = await fetchPayment(body.paymentId, checkout.providerOrderId, checkout.amountPaise);
  if (payment.id !== body.paymentId) throw new Error("Payment identity mismatch");
  return finalize(checkout, payment);
}
export async function reconcileCheckout(id: string,force=false) {
  const checkout = await checkoutStatus(id,{operation:'reconcile',count:10});
  if ((!force&&checkout.receiptToken) || !checkout.providerOrderId) return checkout;
  const payments = await fetchOrderPayments(checkout.providerOrderId);
  for (const payment of payments.filter((item) => item.status === "captured")) await finalize(checkout, payment);
  return checkoutStatus(id);
}
