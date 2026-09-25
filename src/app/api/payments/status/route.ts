import {membershipTypeSchema} from '@/features/registration/membership';
import { api } from "@/server/http";
import { getCheckoutId, requireCheckout,getCheckoutMode,checkoutCookie } from "@/features/registration/server/checkout";
import { checkoutStatus, reconcileCheckout } from "@/features/payments/server/payments";
import { cookies } from "next/headers";
import { AppError } from "@/shared/errors";

export async function GET(request: Request) {
  return api(request, async () => {
    const type=membershipTypeSchema.parse(new URL(request.url).searchParams.get("membershipType")??"standard");
    const id = await getCheckoutId(type);
    try{return Response.json({ data: id ? await checkoutStatus(id,{operation:'status',count:30}) : null });}
    catch(error){
      if(!(error instanceof AppError)||error.code!=='CHECKOUT_NOT_FOUND')throw error;
      (await cookies()).delete(checkoutCookie(type));
      return Response.json({data:null});
    }
  });
}
export async function POST(request: Request) {
  return api(request, async () => {
    const type=membershipTypeSchema.parse(new URL(request.url).searchParams.get("membershipType")??"standard");
    const id = await requireCheckout(undefined,type);
    return Response.json({ data: await reconcileCheckout(id,false,await getCheckoutMode(type)) });
  });
}
export async function DELETE(request: Request) {
  return api(request, async () => {
    const type=membershipTypeSchema.parse(new URL(request.url).searchParams.get("membershipType")??"standard");
    const checkout = await checkoutStatus(await requireCheckout(undefined,type));
    if (!checkout.receiptToken) throw new AppError(409, "PAYMENT_PENDING", "Complete or resolve the current registration before starting another.");
    (await cookies()).delete(checkoutCookie(type));
    return Response.json({ data: null });
  });
}
