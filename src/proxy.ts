import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession, COOKIE_NAME } from "@/lib/admin-auth";

// Paths reachable without a session. The login page and its POST/DELETE
// endpoint are the only public admin surface.
const PUBLIC_ADMIN_PATHS = new Set(["/admin/login", "/api/admin/login"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ADMIN_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const cookieValue = request.cookies.get(COOKIE_NAME)?.value;
  const identity = await verifySession(cookieValue);

  if (!identity) {
    // API routes return 401; pages redirect to the login screen.
    if (pathname.startsWith("/api/admin")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  // Attach the authenticated admin's identity for downstream route handlers.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-admin-id", identity.id);
  requestHeaders.set("x-admin-username", identity.username);
  requestHeaders.set("x-admin-display-name", identity.displayName);
  requestHeaders.set("x-admin-role", identity.role);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
