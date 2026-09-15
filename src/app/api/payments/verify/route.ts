import { api, readJson } from "@/server/http";
import { verificationSchema } from "@/features/payments/schema";
import { verifyPayment } from "@/features/payments/server/payments";
import { requireCheckout,getCheckoutMode } from "@/features/registration/server/checkout";
export async function POST(request: Request) {
  return api(request, async () => {
    const id = await requireCheckout();
    const body = verificationSchema.parse(await readJson(request));
    return Response.json({ data: await verifyPayment(id, body,await getCheckoutMode()) });
  });
}
