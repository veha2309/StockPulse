import "server-only";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { supabase } from "./server-db";

export function databaseError(error: { code?: string; message?: string }) {
  if (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    error.code === "42P01"
  )
    return NextResponse.json(
      {
        error:
          "Account services require a database update. Please contact the administrator.",
      },
      { status: 503 },
    );
  console.error("[database]", error);
  return NextResponse.json(
    { error: "Unable to complete request. Please try again." },
    { status: 503 },
  );
}
export async function rateLimit(
  scope: string,
  identity: string,
  limit: number,
  windowSeconds: number,
) {
  const key = createHash("sha256").update(`${scope}:${identity}`).digest("hex");
  const { data, error } = await supabase.rpc("stockpulse_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window: windowSeconds,
  });
  if (error) return databaseError(error);
  return data
    ? null
    : NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(windowSeconds) } },
      );
}
