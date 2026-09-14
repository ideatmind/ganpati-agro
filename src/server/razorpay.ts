import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { isPaymentDemo, requiredEnv } from "@/server/env";
import { orderSchema, paymentSchema } from "@/features/payments/schema";
import { z } from "zod";
import { timed } from "@/server/timing";

export interface RazorpayOrder { id: string; amount: number; currency: "INR" }

function authHeader() {
  return `Basic ${Buffer.from(`${requiredEnv("RAZORPAY_KEY_ID")}:${requiredEnv("RAZORPAY_KEY_SECRET")}`).toString("base64")}`;
}

export async function createRazorpayOrder(amount: number, receipt: string): Promise<RazorpayOrder> {
  return timed('provider.order',()=>createOrder(amount,receipt));
}
async function createOrder(amount:number,receipt:string):Promise<RazorpayOrder>{
  if (isPaymentDemo()) return { id: `demo_order_${randomUUID()}`, amount, currency: "INR" };
  const response = await fetch("https://api.razorpay.com/v1/orders", { method: "POST", headers: { Authorization: authHeader(), "Content-Type": "application/json" }, body: JSON.stringify({ amount, currency: "INR", receipt }), signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Unable to create payment order");
  return orderSchema.parse(await response.json());
}

export function verifyCheckoutSignature(orderId: string, paymentId: string, received: string) {
  if (isPaymentDemo() && orderId.startsWith("demo_order_") && paymentId.startsWith("demo_payment_") && received === "demo") return true;
  const expected = Buffer.from(createHmac("sha256", requiredEnv("RAZORPAY_KEY_SECRET")).update(`${orderId}|${paymentId}`).digest("hex"));
  const actual = Buffer.from(received);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function verifyWebhookSignature(raw: string, received: string) {
  const expected = Buffer.from(createHmac("sha256", requiredEnv("RAZORPAY_WEBHOOK_SECRET")).update(raw).digest("hex"));
  const actual = Buffer.from(received);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function fetchPayment(paymentId: string, demoOrderId?: string, demoAmount?: number) {
  return timed('provider.payment',()=>readPayment(paymentId,demoOrderId,demoAmount));
}
async function readPayment(paymentId:string,demoOrderId?:string,demoAmount?:number){
  if (isPaymentDemo() && paymentId.startsWith("demo_payment_") && demoOrderId?.startsWith("demo_order_")) return paymentSchema.parse({ id: paymentId, order_id: demoOrderId, status: "captured", amount: demoAmount, currency: "INR" });
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: authHeader() }, cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Unable to verify payment status");
  return paymentSchema.parse(await response.json());
}

export async function fetchOrderPayments(orderId: string) {
  return timed('provider.orderPayments',()=>readOrderPayments(orderId));
}
async function readOrderPayments(orderId:string){
  if (isPaymentDemo() && orderId.startsWith("demo_order_")) return [];
  const response = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}/payments`, { headers: { Authorization: authHeader() }, cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Payment provider unavailable");
  return z.object({ items: z.array(paymentSchema).max(100) }).parse(await response.json()).items;
}
