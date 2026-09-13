import { z } from "zod";
import { callRpc } from "@/server/database";
import { fetchPayment, verifyCheckoutSignature } from "@/server/razorpay";

const bodySchema = z.object({ orderId: z.string().min(5), paymentId: z.string().min(5), signature: z.string().min(4), payerKind: z.enum(["farmer","employee"]).default("farmer") });

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    if (!verifyCheckoutSignature(body.orderId, body.paymentId, body.signature)) return Response.json({ error: "Payment signature is invalid" }, { status: 400 });
    const payment = await fetchPayment(body.paymentId);
    if (payment.status !== "captured") return Response.json({ error: "Payment has not been captured" }, { status: 409 });
    const data = await callRpc("finalize_registration_payment", {
      p_provider_order_id: body.orderId,
      p_provider_payment_id: body.paymentId,
      p_amount_paise: payment.amount,
      p_currency: payment.currency,
      p_payer_kind: body.payerKind,
      p_signature_verified: true,
    });
    return Response.json({ data });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Payment could not be verified" }, { status: 400 });
  }
}
