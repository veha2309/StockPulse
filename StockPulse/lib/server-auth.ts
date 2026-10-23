import { NextResponse } from "next/server";
import { cookieName, signSession, SESSION_TTL, type Session } from "./session";

export function sessionResponse(
  data: unknown,
  role: Session["role"],
  email: string,
) {
  const response = NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
  response.cookies.set(cookieName(role), signSession(role, email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
  return response;
}

export function logoutResponse(role: Session["role"]) {
  const response = NextResponse.json({ success: true });
  response.cookies.set(cookieName(role), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function validEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
