/**
 * Server-only Supabase REST helper.
 * Uses fetch() to call Supabase RPC functions with the service_role key.
 * Never import this file from client components.
 */

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface RpcOptions {
  /** Next.js Data Cache options. Calls are uncached unless explicitly opted in. */
  next?: { revalidate?: number; tags?: string[] };
}

export async function callRpc<T = unknown>(
  functionName: string,
  params: Record<string, unknown>,
  options: RpcOptions = {}
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
      cache: options.next ? "force-cache" : "no-store",
      next: options.next,
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let message = "Supabase RPC failed";
    try {
      const parsed = JSON.parse(text) as { message?: string };
      if (parsed.message) message = parsed.message;
    } catch {
      // Non-JSON error body; keep the generic message.
    }
    console.error(`[supabase] RPC ${functionName} failed`, {
      status: response.status,
      text,
    });
    throw new Error(message);
  }

  return response.json();
}
