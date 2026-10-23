import type { UserData } from "./types";

export function safeUser(u: Record<string, unknown>): UserData {
  const balance = Number(u.etokens ?? u.e_tokens ?? u.eTokens ?? 0);
  return {
    name: String(u.name || ""),
    email: String(u.email || ""),
    eTokens: Number.isFinite(balance) ? balance : 0,
    portfolio: Array.isArray(u.portfolio) ? u.portfolio : [],
    options: Array.isArray(u.options) ? u.options : [],
  };
}
