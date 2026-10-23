import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type Session = { role: "user" | "admin"; email: string; exp: number };
export const SESSION_TTL = 8 * 60 * 60;
export const cookieName = (role: Session["role"]) => `stockpulse_${role}`;

function secret() {
  const key =
    process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || key.length < 32)
    throw new Error(
      "Configure SESSION_SECRET (at least 32 characters) or SUPABASE_SERVICE_ROLE_KEY",
    );
  return key;
}

export function equalSecrets(a: string, b: string) {
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
}

export function signSession(
  role: Session["role"],
  email: string,
  now = Date.now(),
) {
  const payload = Buffer.from(
    JSON.stringify({ role, email, exp: Math.floor(now / 1000) + SESSION_TTL }),
  ).toString("base64url");
  // Admin password rotation also invalidates previously issued admin cookies.
  const signature = createHmac("sha256", secret())
    .update(
      `${payload}:${role === "admin" ? process.env.ADMIN_PASSWORD || "" : "user"}`,
    )
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySession(
  token: string | undefined,
  role: Session["role"],
  now = Date.now(),
): Session | null {
  if (!token || token.length > 2048) return null;
  try {
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra) return null;
    const expected = createHmac("sha256", secret())
      .update(
        `${payload}:${role === "admin" ? process.env.ADMIN_PASSWORD || "" : "user"}`,
      )
      .digest("base64url");
    if (!equalSecrets(signature, expected)) return null;
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    ) as Session;
    return session.role === role &&
      typeof session.email === "string" &&
      session.email.length > 0 &&
      Number.isFinite(session.exp) &&
      session.exp > now / 1000
      ? session
      : null;
  } catch {
    return null;
  }
}

export function requestSession(
  request: Request,
  role: Session["role"] = "user",
) {
  const cookie = (request.headers.get("cookie") || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName(role)}=`));
  return verifySession(cookie?.slice(cookieName(role).length + 1), role);
}

export function hashOtp(email: string, otp: string) {
  return createHmac("sha256", secret())
    .update(`otp:${email}:${otp}`)
    .digest("hex");
}
