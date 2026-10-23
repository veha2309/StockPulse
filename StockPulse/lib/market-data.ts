import "server-only";
import { validSymbol } from "./trading";

const indices: Record<string, string> = {
  "NSE:NIFTY_50": "^NSEI",
  "NSE:NIFTY_BANK": "^NSEBANK",
  "NSE:NIFTY_IT": "^CNXIT",
  "NSE:NIFTY_MIDCAP_50": "^NSEMDCP50",
  "BSE:SENSEX": "^BSESN",
};
export const yahooSymbol = (symbol: string) =>
  indices[symbol] ||
  symbol.slice(4) + (symbol.startsWith("NSE:") ? ".NS" : ".BO");

export async function yahooChart(symbol: string, interval: "1d" | "5m") {
  if (!validSymbol(symbol)) throw new Error("Invalid symbol");
  for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
    try {
      const response = await fetch(
        `https://${host}/v8/finance/chart/${encodeURIComponent(yahooSymbol(symbol))}?interval=${interval}&range=1d`,
        {
          headers: { "User-Agent": "Mozilla/5.0" },
          cache: "no-store",
          signal: AbortSignal.timeout(6000),
        },
      );
      if (!response.ok) continue;
      const json = await response.json();
      const result = json?.chart?.result?.[0];
      if (result && !json?.chart?.error) return result;
    } catch {
      /* Try the secondary source. Never invent prices. */
    }
  }
  throw new Error("Market data is temporarily unavailable");
}

export async function executionPrice(symbol: string) {
  const result = await yahooChart(symbol, "1d");
  const price = result.meta?.regularMarketPrice;
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0)
    throw new Error("No executable price available");
  return price;
}
