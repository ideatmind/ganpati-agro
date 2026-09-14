import { z } from "zod";
import { api, readJson } from "@/server/http";
import { requireCheckout } from "@/features/registration/server/checkout";
import { startOrder } from "@/features/payments/server/payments";
export async function POST(request: Request) {
  return api(request, async () => {
    const body = z.object({ registrationId: z.uuid() }).parse(await readJson(request));
    const id = await requireCheckout(body.registrationId);
    return Response.json({ data: await startOrder(id) });
  });
}
