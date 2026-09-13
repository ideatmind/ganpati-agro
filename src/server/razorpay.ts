import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { isPaymentDemo, requiredEnv } from "@/server/env";

export interface RazorpayOrder { id: string; amount: number; currency: "INR" }

function authHeader() {
  return `Basic ${Buffer.from(`${requiredEnv("RAZORPAY_KEY_ID")}:${requiredEnv("RAZORPAY_KEY_SECRET")}`).toString("base64")}`;
}

export async function createRazorpayOrder(amount: number, receipt: string): Promise<RazorpayOrder> {
  if (isPaymentDemo()) return { id: `demo_order_${randomUUID()}`, amount, currency: "INR" };
  const response = await fetch("https://api.razorpay.com/v1/orders", { method: "POST", headers: { Authorization: authHeader(), "Content-Type": "application/json" }, body: JSON.stringify({ amount, currency: "INR", receipt }) });
  if (!response.ok) throw new Error("Unable to create payment order");
  return response.json() as Promise<RazorpayOrder>;
}

export function verifyCheckoutSignature(orderId: string, paymentId: string, received: string) {
  if (isPaymentDemo() && orderId.startsWith("demo_order_") && received === "demo") return true;
  const expected = Buffer.from(createHmac("sha256", requiredEnv("RAZORPAY_KEY_SECRET")).update(`${orderId}|${paymentId}`).digest("hex"));
  const actual = Buffer.from(received);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function verifyWebhookSignature(raw: string, received: string) {
  const expected = Buffer.from(createHmac("sha256", requiredEnv("RAZORPAY_WEBHOOK_SECRET")).update(raw).digest("hex"));
  const actual = Buffer.from(received);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function fetchPayment(paymentId: string) {
  if (isPaymentDemo() && paymentId.startsWith("demo_payment_")) return { id: paymentId, status: "captured", amount: 50_000, currency: "INR" };
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: authHeader() }, cache: "no-store" });
  if (!response.ok) throw new Error("Unable to verify payment status");
  return response.json() as Promise<{ id: string; status: string; amount: number; currency: string }>;
}
