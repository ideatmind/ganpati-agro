import { registrationSchema } from "@/features/registration/schema";
import { callRpc } from "@/server/database";
import { protectAadhaar } from "@/server/pii";
import { clientIp, rateLimited } from "@/server/rate-limit";
import { getIdentity } from "@/server/session";

export async function POST(request: Request) {
  const ip = clientIp(request.headers);
  if (rateLimited(`registration:${ip}`, 5, 60_000)) return Response.json({ error: "Too many attempts. Please wait a minute." }, { status: 429 });
  try {
    const parsed = registrationSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Please check the form." }, { status: 400 });
    const identity = await getIdentity();
    const isEmployee = Boolean(identity?.roles.some((role) => role === "employee" || role === "manager" || role === "super_admin"));
    const aadhaar = protectAadhaar(parsed.data.aadhar_no);
    const payload = {
      ...parsed.data,
      aadhar_no: undefined,
      aadhar_fingerprint: aadhaar.fingerprint,
      aadhar_ciphertext: aadhaar.ciphertext,
      aadhar_last_four: aadhaar.lastFour,
      onboarding_employee_id: isEmployee && identity ? identity.id : null,
    };
    const data = await callRpc<{ id: string; reference: string; amountPaise: number; status: string }>("create_registration", { p_payload: payload });
    return Response.json({ data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration could not be saved";
    const conflict = /already exists/i.test(message);
    return Response.json({ error: message }, { status: conflict ? 409 : 500 });
  }
}
