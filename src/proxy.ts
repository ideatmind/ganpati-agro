import { NextResponse, type NextRequest } from "next/server";
import { allowedMutation } from "@/shared/request-policy";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/") && request.nextUrl.pathname !== "/api/payments/webhook" && !allowedMutation(request, process.env.APP_ORIGIN || process.env.NEXT_PUBLIC_APP_URL)) {
    return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  }
  if (request.nextUrl.pathname.startsWith("/dashboard") && !request.cookies.has("ga_session")) return NextResponse.redirect(new URL("/login", request.url));
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/dashboard/:path*", "/api/:path*", "/receipt/:path*"] };
