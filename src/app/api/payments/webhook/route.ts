import { callRpc } from "@/server/database";
import { verifyWebhookSignature } from "@/server/razorpay";

interface PaymentEntity { id?: string; order_id?: string; amount?: number; currency?: string; status?: string }

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") || "";
  const eventId = request.headers.get("x-razorpay-event-id") || "";
  if (!eventId || !verifyWebhookSignature(raw, signature)) return Response.json({ error: "Invalid webhook" }, { status: 400 });
  try {
    const body = JSON.parse(raw) as { event?: string; payload?: { payment?: { entity?: PaymentEntity } } };
    const payment = body.payload?.payment?.entity;
    if (body.event !== "payment.captured" || !payment?.id || !payment.order_id || payment.status !== "captured") return Response.json({ data: { ignored: true } });
    await callRpc("record_payment_event", {
      p_event_id: eventId,
      p_event_type: body.event,
      p_provider_order_id: payment.order_id,
      p_provider_payment_id: payment.id,
      p_amount_paise: payment.amount,
      p_currency: payment.currency,
      p_summary: { paymentId: payment.id, orderId: payment.order_id, status: payment.status },
    });
    return Response.json({ data: { accepted: true } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Webhook processing failed" }, { status: 500 });
  }
}
