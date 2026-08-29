import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession, COOKIE_NAME } from "@/lib/admin-auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /admin/* routes (but not /admin/login)
  if (!pathname.startsWith("/admin")) return NextResponse.next();
  if (pathname === "/admin/login") return NextResponse.next();

  // Also protect /api/admin/* routes (but not /api/admin/login)
  if (pathname.startsWith("/api/admin/login")) return NextResponse.next();

  const cookieValue = request.cookies.get(COOKIE_NAME)?.value;
  const isValid = await verifySession(cookieValue);

  if (!isValid) {
    // API routes get 401, pages get redirected to login
    if (pathname.startsWith("/api/admin")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
