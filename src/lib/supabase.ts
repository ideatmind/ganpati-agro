/**
 * Server-only Supabase REST helper.
 * Uses fetch() to call Supabase RPC functions with the service_role key.
 * Never import this file from client components.
 */

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function callRpc<T = unknown>(
  functionName: string,
  params: Record<string, unknown>
): Promise<T> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase server configuration");
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/${functionName}`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error(`[supabase] RPC ${functionName} failed`, {
      status: response.status,
      text,
    });
    throw new Error("Supabase RPC failed");
  }

  return response.json();
}
