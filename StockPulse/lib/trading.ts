import type { UserData, OptionPosition } from "./types";

export class TradeError extends Error {}
export function positiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
export function validSymbol(value: unknown): value is string {
  return (
    typeof value === "string" && /^(NSE|BSE):[A-Z0-9_&.\-]{1,40}$/.test(value)
  );
}
export const money = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export type TradeInput = {
  action: "buy" | "sell";
  tradeType: "equity" | "option";
  symbol: string;
  quantity: number;
  price: number;
  positionId?: string;
  contract?: {
    contractSymbol: string;
    underlyingSymbol: string;
    type: "call" | "put";
    strike: number;
    expiration: number;
  };
};

// Pure accounting: the route supplies a server-verified execution price.
export function applyTrade(
  user: UserData,
  order: TradeInput,
  id: string,
  timestamp: string,
) {
  const { action, tradeType, quantity, price } = order;
  if (
    !["buy", "sell"].includes(action) ||
    !["equity", "option"].includes(tradeType) ||
    !validSymbol(order.symbol) ||
    !positiveNumber(quantity) ||
    !Number.isSafeInteger(quantity) ||
    !positiveNumber(price)
  )
    throw new TradeError("Invalid order fields");
  const total = money(quantity * price);
  if (!Number.isSafeInteger(Math.round(total * 100)) || total <= 0)
    throw new TradeError("Order value is out of range");
  if (!Number.isFinite(user.eTokens) || user.eTokens < 0)
    throw new TradeError("Invalid account balance");
  if (action === "buy" && user.eTokens < total)
    throw new TradeError("Insufficient virtual funds");
  const portfolio = user.portfolio.map((p) => ({ ...p }));
  let options = user.options.map((p) => ({ ...p }));
  if (tradeType === "equity") {
    const holding = portfolio.find((p) => p.symbol === order.symbol);
    if (action === "buy") {
      if (holding) {
        const previousCost = holding.amount * holding.avgBuyPrice;
        holding.amount += quantity;
        holding.avgBuyPrice =
          (previousCost + quantity * price) / holding.amount;
      } else
        portfolio.push({
          symbol: order.symbol,
          amount: quantity,
          avgBuyPrice: price,
        });
    } else {
      if (!holding || holding.amount < quantity)
        throw new TradeError("Insufficient shares to sell");
      holding.amount -= quantity;
    }
  } else {
    const contract = order.contract;
    if (
      !contract ||
      !contract.contractSymbol ||
      contract.underlyingSymbol !== order.symbol ||
      !positiveNumber(contract.strike) ||
      !positiveNumber(contract.expiration) ||
      !["call", "put"].includes(contract.type)
    )
      throw new TradeError("Invalid option contract");
    const matches = (p: OptionPosition) =>
      p.contractSymbol === contract.contractSymbol &&
      p.underlyingSymbol === contract.underlyingSymbol &&
      p.type === contract.type &&
      p.expiration === contract.expiration &&
      p.strike === contract.strike &&
      p.side === "buy";
    if (action === "buy") {
      const existing = options.find(matches);
      if (existing) {
        existing.premium =
          (existing.premium * existing.lots + price * quantity) /
          (existing.lots + quantity);
        existing.lots += quantity;
      } else
        options.push({
          id,
          ...contract,
          lots: quantity,
          premium: price,
          side: "buy",
          timestamp,
        });
    } else {
      const positions = options.filter(
        (p) => matches(p) && (!order.positionId || p.id === order.positionId),
      );
      if (positions.reduce((sum, p) => sum + p.lots, 0) < quantity)
        throw new TradeError("Insufficient option units to sell");
      let remaining = quantity;
      for (const position of positions) {
        const sold = Math.min(remaining, position.lots);
        position.lots -= sold;
        remaining -= sold;
        if (!remaining) break;
      }
      options = options.filter((p) => p.lots > 0);
    }
  }
  return {
    ...user,
    eTokens: money(user.eTokens + (action === "buy" ? -total : total)),
    portfolio: portfolio.filter((p) => p.amount > 0),
    options,
    total,
  };
}
