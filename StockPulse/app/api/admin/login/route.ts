import { rateLimit } from "@/lib/database";
import { NextResponse } from "next/server";
import { equalSecrets, requestSession } from "@/lib/session";
import { sessionResponse, logoutResponse } from "@/lib/server-auth";

export async function GET(request: Request) {
  return NextResponse.json(
    { authenticated: !!requestSession(request, "admin") },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function DELETE() {
  return logoutResponse("admin");
}
export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    const limited = await rateLimit(
      "admin-login",
      request.headers.get("x-forwarded-for")?.split(",")[0] || "local",
      10,
      900,
    );
    if (limited) return limited;
    const expected = process.env.ADMIN_PASSWORD;
    if (
      !expected ||
      typeof password !== "string" ||
      !equalSecrets(password, expected)
    )
      return NextResponse.json(
        { error: "Invalid admin password" },
        { status: 401 },
      );
    return sessionResponse({ success: true }, "admin", "admin");
  } catch {
    return NextResponse.json({ error: "Unable to sign in" }, { status: 400 });
  }
}
