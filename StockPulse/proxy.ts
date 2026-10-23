import { NextRequest, NextResponse } from "next/server";
import { requestSession } from "./lib/session";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const unsafe = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  if (unsafe) {
    const origin = request.headers.get("origin");
    if (
      (origin && origin !== request.nextUrl.origin) ||
      request.headers.get("sec-fetch-site") === "cross-site"
    ) {
      return NextResponse.json(
        { error: "Cross-site request denied" },
        { status: 403 },
      );
    }
  }
  const publicAdminConfig =
    ["/api/admin/favorites", "/api/admin/learnings"].includes(path) &&
    request.method === "GET";
  const admin =
    path.startsWith("/api/admin/") &&
    path !== "/api/admin/login" &&
    !publicAdminConfig;
  const user =
    ["/api/trade", "/api/targets", "/api/history", "/api/recharge"].includes(
      path,
    ) ||
    (path === "/api/auth" && request.method === "GET");
  if (admin && !requestSession(request, "admin"))
    return NextResponse.json(
      { error: "Admin sign-in required" },
      { status: 401 },
    );
  if (user && !requestSession(request))
    return NextResponse.json({ error: "Sign-in required" }, { status: 401 });
  const response = NextResponse.next();
  if (admin || user || path === "/api/auth")
    response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = { matcher: "/api/:path*" };
