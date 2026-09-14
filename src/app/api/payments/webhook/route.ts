import { z } from "zod";
import { callRpc } from "@/server/database";
import { api, readBody } from "@/server/http";
import { verifyWebhookSignature } from "@/server/razorpay";
import { paymentSchema } from "@/features/payments/schema";
import { AppError } from "@/shared/errors";
export async function POST(request: Request) {
  return api(request, async () => {
    const raw = await readBody(request, 262_144);
    const eventId = request.headers.get('x-razorpay-event-id') || '';
    if (!eventId || eventId.length>200 || !verifyWebhookSignature(raw, request.headers.get('x-razorpay-signature') || '')) throw new AppError(400, 'INVALID_WEBHOOK', 'Invalid webhook.');
    const body = z.object({ event: z.string().max(100), payload: z.unknown().optional() }).parse(JSON.parse(raw));
    const captured = ['payment.captured','order.paid'].includes(body.event);
    const entity = z.object({ payment: z.object({ entity: z.unknown() }).optional() }).safeParse(body.payload);
    const payment = captured ? paymentSchema.parse(entity.success ? entity.data.payment?.entity : undefined) : null;
    const notification = z.object({ payment:z.object({entity:z.object({id:z.string().max(100),order_id:z.string().max(100).nullish(),amount:z.number().int().optional(),currency:z.string().max(3).optional()})}).optional(),refund:z.object({entity:z.object({payment_id:z.string().max(100),amount:z.number().int().optional()})}).optional(),dispute:z.object({entity:z.object({payment_id:z.string().max(100),amount:z.number().int().optional()})}).optional() }).safeParse(body.payload);
    const details=notification.success?notification.data:undefined;
    if (payment && payment.status !== 'captured') throw new AppError(400, 'INVALID_CAPTURE', 'Invalid capture event.');
    const result = await callRpc<{failed?:boolean}>('record_payment_event', { p_event_id:eventId, p_event_type:body.event, p_provider_order_id:payment?.order_id ?? details?.payment?.entity.order_id ?? null, p_provider_payment_id:payment?.id ?? details?.payment?.entity.id ?? details?.refund?.entity.payment_id ?? details?.dispute?.entity.payment_id ?? null, p_amount_paise:payment?.amount ?? details?.payment?.entity.amount ?? details?.refund?.entity.amount ?? details?.dispute?.entity.amount ?? null, p_currency:payment?.currency ?? details?.payment?.entity.currency ?? null, p_summary:{} });
    if (result.failed) throw new AppError(503, 'WEBHOOK_RETRY', 'Processing is pending. Retry this event.');
    return Response.json({data:{accepted:true}});
  });
}
