import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requestSession } from "@/lib/session";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if (params.get("connect") !== "1")
    return NextResponse.json({
      mode: "polling",
      message:
        "Prices refresh from the market-data provider. A decoded Upstox stream is not implemented.",
    });
  if (!requestSession(request, "admin"))
    return NextResponse.json(
      { error: "Admin sign-in required" },
      { status: 401 },
    );
  const clientId = process.env.UPSTOX_CLIENT_ID,
    redirect = process.env.UPSTOX_REDIRECT_URI;
  if (!clientId || !redirect)
    return NextResponse.json(
      { error: "Upstox is not configured" },
      { status: 503 },
    );
  const state = randomBytes(32).toString("hex");
  const url = new URL("https://api.upstox.com/v2/login/authorization/dialog");
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirect,
    state,
  }).toString();
  const response = NextResponse.json({
    mode: "need_auth",
    loginUrl: url.toString(),
  });
  response.cookies.set("stockpulse_upstox_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
