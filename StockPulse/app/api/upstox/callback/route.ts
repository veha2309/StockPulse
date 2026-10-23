import { requestSession, equalSecrets } from "@/lib/session";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/server-db";

/**
 * GET /api/upstox/callback
 * Receives the auth code from Upstox, exchanges it for access token,
 * and saves it into Supabase database config.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookie = (request.headers.get("cookie") || "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("stockpulse_upstox_state="))
    ?.slice("stockpulse_upstox_state=".length);
  if (
    !requestSession(request, "admin") ||
    !state ||
    !cookie ||
    !equalSecrets(state, cookie)
  )
    return NextResponse.json(
      { error: "Invalid OAuth state or admin session" },
      { status: 403 },
    );

  if (!code) {
    return NextResponse.json(
      { error: "Auth code missing from Upstox redirect" },
      { status: 400 },
    );
  }

  const clientId = process.env.UPSTOX_CLIENT_ID;
  const clientSecret = process.env.UPSTOX_CLIENT_SECRET;
  const redirectUri = process.env.UPSTOX_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: "Upstox environmental variables not configured" },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(
      "https://api.upstox.com/v2/login/authorization/token",
      {
        method: "POST",
        signal: AbortSignal.timeout(10000),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      },
    );

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Failed to exchange code: ${errBody}`);
    }

    const tokenData = await response.json();

    // Store in Supabase app_config so both Web and Mobile apps can fetch it
    if (typeof tokenData.access_token !== "string" || !tokenData.access_token)
      throw new Error("No access token returned");
    const { error: saveError } = await supabase.from("app_config").upsert({
      key: "upstox_access_token",
      value: {
        access_token: tokenData.access_token,
        user_name: tokenData.user_name,
        email: tokenData.email,
        updated_at: new Date().toISOString(),
      },
    });

    if (saveError) throw saveError;
    const redirectResponse = NextResponse.redirect(
      new URL("/?upstox_linked=true", request.url),
    );
    redirectResponse.cookies.set("stockpulse_upstox_state", "", {
      path: "/",
      maxAge: 0,
    });
    return redirectResponse;
  } catch (err) {
    console.error("Upstox callback exchange error:", err);
    return NextResponse.json(
      { error: "OAuth exchange failed" },
      { status: 500 },
    );
  }
}
