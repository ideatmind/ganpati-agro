import { api } from "@/server/http";
import { getCheckoutId, requireCheckout,getCheckoutMode } from "@/features/registration/server/checkout";
import { checkoutStatus, reconcileCheckout } from "@/features/payments/server/payments";
import { cookies } from "next/headers";
import { AppError } from "@/shared/errors";

export async function GET(request: Request) {
  return api(request, async () => {
    const id = await getCheckoutId();
    return Response.json({ data: id ? await checkoutStatus(id,{operation:'status',count:30}) : null });
  });
}
export async function POST(request: Request) {
  return api(request, async () => {
    const id = await requireCheckout();
    return Response.json({ data: await reconcileCheckout(id,false,await getCheckoutMode()) });
  });
}
export async function DELETE(request: Request) {
  return api(request, async () => {
    const checkout = await checkoutStatus(await requireCheckout());
    if (!checkout.receiptToken) throw new AppError(409, "PAYMENT_PENDING", "Complete or resolve the current registration before starting another.");
    (await cookies()).delete("ga_checkout");
    return Response.json({ data: null });
  });
}
