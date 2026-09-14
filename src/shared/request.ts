export async function requestJson<T>(url: string, body?: unknown, method = "POST"): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal, cache: "no-store" });
    const result = await response.json().catch(() => ({})) as T & { error?: string };
    if (!response.ok) throw new Error(result.error || "Request could not be completed.");
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("The request timed out. Its result may still be processing. Check the status before trying again.");
    if (error instanceof TypeError) throw new Error("Connection lost. Reconnect and check the status before trying again.");
    throw error;
  } finally { clearTimeout(timer); }
}
