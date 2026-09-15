import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { isPaymentDemo } from "@/server/env";
import { orderSchema, paymentSchema } from "@/features/payments/schema";
import { z } from "zod";
import { timed } from "@/server/timing";
import {defaultPaymentMode,productionPayments,paymentKeyId,paymentSecret,webhookSecret,type PaymentMode} from '@/server/payment-mode';

export interface RazorpayOrder { id: string; amount: number; currency: "INR" }

function authHeader(mode:PaymentMode) {
  return `Basic ${Buffer.from(`${paymentKeyId(mode)}:${paymentSecret(mode)}`).toString("base64")}`;
}

export async function createRazorpayOrder(amount: number, receipt: string,mode:PaymentMode=defaultPaymentMode()): Promise<RazorpayOrder> {
  return timed('provider.order',()=>createOrder(amount,receipt,mode));
}
async function createOrder(amount:number,receipt:string,mode:PaymentMode):Promise<RazorpayOrder>{
  if (isPaymentDemo()) return { id: `demo_order_${randomUUID()}`, amount, currency: "INR" };
  const response = await fetch("https://api.razorpay.com/v1/orders", { method: "POST", headers: { Authorization: authHeader(mode), "Content-Type": "application/json" }, body: JSON.stringify({ amount, currency: "INR", receipt }), signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Unable to create payment order");
  return orderSchema.parse(await response.json());
}

export function verifyCheckoutSignature(orderId: string, paymentId: string, received: string,mode:PaymentMode=defaultPaymentMode()) {
  if (isPaymentDemo() && orderId.startsWith("demo_order_") && paymentId.startsWith("demo_payment_") && received === "demo") return true;
  const expected = Buffer.from(createHmac("sha256", paymentSecret(mode)).update(`${orderId}|${paymentId}`).digest("hex"));
  const actual = Buffer.from(received);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function verifyWebhookSignature(raw: string, received: string) {
  const actual = Buffer.from(received);
  const secrets=[webhookSecret()].filter((value):value is string=>Boolean(value));
  return secrets.some(secret=>{const expected=Buffer.from(createHmac('sha256',secret).update(raw).digest('hex'));return expected.length===actual.length&&timingSafeEqual(expected,actual);});
}

export async function fetchPayment(paymentId: string, demoOrderId?: string, demoAmount?: number,mode:PaymentMode=defaultPaymentMode()) {
  return timed('provider.payment',()=>readPayment(paymentId,demoOrderId,demoAmount,mode));
}
async function readPayment(paymentId:string,demoOrderId:string|undefined,demoAmount:number|undefined,mode:PaymentMode){
  if (isPaymentDemo() && paymentId.startsWith("demo_payment_") && demoOrderId?.startsWith("demo_order_")) return paymentSchema.parse({ id: paymentId, order_id: demoOrderId, status: "captured", amount: demoAmount, currency: "INR" });
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: authHeader(mode) }, cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Unable to verify payment status");
  return paymentSchema.parse(await response.json());
}

export async function fetchOrderPayments(orderId: string,mode?:PaymentMode) {
  return timed('provider.orderPayments',()=>readOrderPayments(orderId,mode));
}
async function readOrderPayments(orderId:string,mode?:PaymentMode){
  if (isPaymentDemo() && orderId.startsWith("demo_order_")) return [];
  const modes=mode?[mode]:(['live','test'] as const).filter(value=>(!productionPayments()||value==='live')&&paymentKeyId(value));
  for(const selected of modes){
    const response = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}/payments`, { headers: { Authorization: authHeader(selected) }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if(response.ok)return z.object({ items: z.array(paymentSchema).max(100) }).parse(await response.json()).items;
    if(![400,404].includes(response.status))throw new Error('Payment provider unavailable');
  }
  throw new Error('Payment order is unavailable for the selected mode.');
}

export async function verifyOrderMode(orderId:string,mode:PaymentMode){
  if(isPaymentDemo()&&orderId.startsWith('demo_order_'))return;
  const response=await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`,{headers:{Authorization:authHeader(mode)},cache:'no-store',signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error('This saved order cannot be opened in the selected payment mode.');
  const order=orderSchema.parse(await response.json());if(order.id!==orderId)throw new Error('Payment order mismatch');
}
