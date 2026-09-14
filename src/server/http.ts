import "server-only";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { AppError } from "@/shared/errors";
import { requestTimings } from "@/server/timing";

export async function readBody(request: Request, limit = 32_768): Promise<string> {
  if (Number(request.headers.get("content-length")) > limit) throw new AppError(413, "BODY_TOO_LARGE", "Request is too large.");
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new AppError(413, "BODY_TOO_LARGE", "Request is too large.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks).toString("utf8");
}

export async function readJson(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new AppError(415, "CONTENT_TYPE", "Send JSON content.");
  try { return JSON.parse(await readBody(request)); }
  catch (error) {
    if (error instanceof SyntaxError) throw new AppError(400, "INVALID_JSON", "Invalid JSON request.");
    throw error;
  }
}

export async function api(request: Request, work: () => Promise<Response>) {
  const requestId = randomUUID();
  const started = performance.now();
  const timing={requestId,stages:[] as {name:string;durationMs:number}[]};
  let response: Response;
  try { response = await requestTimings.run(timing,work); }
  catch (error) {
    const known = error instanceof AppError;
    const status = known ? error.status : error instanceof ZodError || error instanceof SyntaxError ? 400 : 503;
    const code = known ? error.code : status === 400 ? "VALIDATION_ERROR" : "SERVICE_UNAVAILABLE";
    response = Response.json({ error: known ? error.message : status === 400 ? "Please check the submitted fields." : "Service is temporarily unavailable. Please try again.", code, requestId }, { status });
  }
  response.headers.set("X-Request-Id", requestId);
  response.headers.set("Server-Timing", [...timing.stages.map((stage,index)=>`step${index};desc="${stage.name}";dur=${stage.durationMs}`),`total;dur=${Math.round(performance.now()-started)}`].join(', '));
  response.headers.set("Cache-Control", "private, no-store");
  if (response.status === 429) response.headers.set("Retry-After", "60");
  // Do not log body, URL, actor, headers, tokens, identifiers or exception text.
  const path = new URL(request.url).pathname;
  const operation = path.startsWith("/api/farmers/") ? "/api/farmers/:id" : path.startsWith("/api/receipts/") ? "/api/receipts/:token" : path;
  console.info(JSON.stringify({ event: "api_request", requestId, operation, method: request.method, status: response.status, durationMs: Math.round(performance.now() - started) }));
  return response;
}
