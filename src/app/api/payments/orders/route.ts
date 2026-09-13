import { randomUUID } from "node:crypto";
import { z } from "zod";
import { callRpc } from "@/server/database";
import { createRazorpayOrder } from "@/server/razorpay";

const bodySchema = z.object({ registrationId: z.uuid(), reference: z.string().min(1).max(40), amountPaise: z.literal(50_000) });

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const order = await createRazorpayOrder(body.amountPaise, body.reference);
    const data = await callRpc<{ id: string; providerOrderId: string; amountPaise: number; currency: string }>("record_payment_order", {
      p_registration_id: body.registrationId,
      p_provider_order_id: order.id,
      p_idempotency_key: randomUUID(),
    });
    return Response.json({ data, demo: order.id.startsWith("demo_order_") });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Payment order could not be created" }, { status: 400 });
  }
}
