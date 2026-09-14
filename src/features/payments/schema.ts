import { z } from "zod";

export const paymentSchema = z.object({ id: z.string().min(5).max(100), order_id: z.string().min(5).max(100), status: z.string().max(30), amount: z.number().int().positive().max(2_147_483_647), currency: z.literal("INR") });
export const orderSchema = z.object({ id: z.string().min(5).max(100), amount: z.number().int().positive(), currency: z.literal("INR") });
export const verificationSchema = z.object({ orderId: z.string().min(5).max(100), paymentId: z.string().min(5).max(100), signature: z.string().min(4).max(128) });
export type ProviderPayment = z.infer<typeof paymentSchema>;
export function isMatchingCapture(payment: ProviderPayment, orderId: string, amount: number) {
  return payment.status === "captured" && payment.order_id === orderId && payment.amount === amount && payment.currency === "INR";
}
