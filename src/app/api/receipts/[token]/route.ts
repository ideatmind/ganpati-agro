import { callRpc } from "@/server/database";
import type { ReceiptData } from "@/types";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) return Response.json({ error: "Receipt not found" }, { status: 404 });
  const data = await callRpc<ReceiptData | null>("get_receipt", { p_public_token: token });
  return data ? Response.json({ data }, { headers: { "Cache-Control": "private, no-store" } }) : Response.json({ error: "Receipt not found" }, { status: 404 });
}
