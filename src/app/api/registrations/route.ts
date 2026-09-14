import { registrationSchema } from "@/features/registration/schema";
import { callRpc } from "@/server/database";
import { protectAadhaar } from "@/server/pii";
import { clientIp,enforceLimit } from "@/server/rate-limit";
import { getIdentity } from "@/server/session";
import { api,readJson } from "@/server/http";
import { setCheckout } from "@/features/registration/server/checkout";
export async function POST(request:Request) {
  return api(request,async()=>{
    await enforceLimit('registration:'+clientIp(request.headers),5);
    const data=registrationSchema.parse(await readJson(request));
    const identity=await getIdentity();
    const assisted=identity?.roles.some(role=>['employee','manager','super_admin'].includes(role));
    const protectedId=protectAadhaar(data.aadhar_no);
    const {aadhar_no: omitted, ...input}=data;
    void omitted;
    const result=await callRpc<{id:string;reference:string;amountPaise:number;status:string}>('create_registration',{p_payload:{...input,aadhar_fingerprint:protectedId.fingerprint,aadhar_ciphertext:protectedId.ciphertext,aadhar_last_four:protectedId.lastFour,onboarding_employee_id:assisted?identity!.id:null,cash_received:assisted&&data.cash_received,cash_note:assisted?data.cash_note:''}});
    await setCheckout(result.id);
    return Response.json({data:result},{status:201});
  });
}
