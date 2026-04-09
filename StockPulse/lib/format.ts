/**
 * StockPulse Professional Currency Formatter
 * Handles Indian Numbering System with 4-tier compact notation.
 */

export function formatAmount(n: number, options: { compact?: boolean; symbol?: boolean } = {}) {
  const { compact = true, symbol = true } = options;
  const prefix = symbol ? "₹" : "";

  if (n === null || n === undefined || isNaN(n as number)) return "—";

  const absN = Math.abs(n);
  const sign = n < 0 ? "-" : "";

  if (compact) {
    // 1 Crore = 1,00,00,000
    if (absN >= 10_000_000) {
      return `${sign}${prefix}${(absN / 10_000_000).toFixed(2)} Cr`;
    }
    // 1 Lakh = 1,00,000
    if (absN >= 1_00_000) {
      return `${sign}${prefix}${(absN / 1_00_000).toFixed(2)} L`;
    }
    // 1 Thousand
    if (absN >= 10_000) {
      return `${sign}${prefix}${(absN / 1_000).toFixed(1)}K`;
    }
  }

  // Fallback: full Indian locale formatting
  return `${prefix}${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatCompact(n: number) {
  return formatAmount(n, { compact: true });
}
