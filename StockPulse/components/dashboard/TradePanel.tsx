import { postJSON } from "@/lib/http";
import { useState, useEffect, memo } from "react";
import { motion } from "framer-motion";
import {
  ShoppingCart,
  TrendingUp,
  Wallet,
  ArrowRight,
  Activity,
  Percent,
} from "lucide-react";
import Toast from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import type { UserData, ToastData, Company } from "@/lib/types";
import { formatAmount } from "@/lib/format";

type Props = {
  user: UserData;
  company: Company;
  price: number | null;
  defaultAction?: "buy" | "sell";
  onTradeSuccess: (user: UserData) => void;
};

const TradePanel = memo(
  ({ user, company, price, defaultAction, onTradeSuccess }: Props) => {
    const [amount, setAmount] = useState("");
    const [action, setAction] = useState<"buy" | "sell">(
      defaultAction || "buy",
    );
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<ToastData | null>(null);

    const cost = price && amount ? price * +amount : 0;
    const canAfford = user.eTokens >= cost;
    const hasAsset = (user.portfolio ?? []).find(
      (p) => p.symbol === company.symbol,
    );
    const canSell = hasAsset && hasAsset.amount >= +amount;
    const disabled =
      loading ||
      !price ||
      !Number.isSafeInteger(+amount) ||
      !amount ||
      +amount <= 0 ||
      (action === "buy" && !canAfford) ||
      (action === "sell" && !canSell);

    async function handleTrade(e: React.FormEvent) {
      e.preventDefault();
      if (!price || !Number.isSafeInteger(+amount) || +amount <= 0) {
        setToast({ message: "Enter a positive whole quantity", type: "error" });
        return;
      }
      setLoading(true);
      try {
        const data = await postJSON<{ user: UserData; executionPrice: number }>(
          "/api/trade",
          {
            email: user.email,
            action,
            symbol: company.symbol,
            amount: +amount,
          },
        );
        onTradeSuccess(data.user);
        setToast({
          message:
            (action === "buy" ? "Bought " : "Sold ") +
            amount +
            " shares at " +
            formatAmount(data.executionPrice),
          type: "success",
        });
        setAmount("");
      } catch (error) {
        setToast({
          message:
            error instanceof Error ? error.message : "Unable to place order",
          type: "error",
        });
      } finally {
        setLoading(false);
      }
    }

    useEffect(() => {
      setAmount("");
      setToast(null);
    }, [company]);
    useEffect(() => {
      if (defaultAction) setAction(defaultAction);
    }, [defaultAction, company]);

    return (
      <>
        {toast && <Toast toast={toast} onDone={() => setToast(null)} />}
        <div className="px-4 sm:px-8 py-4 sm:py-5 border-t border-border bg-card z-20">
          <form onSubmit={handleTrade}>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 items-end">
              <div className="col-span-1 md:col-span-1">
                <label className="text-xs font-semibold tracking-normal text-muted-foreground normal-case mb-2 sm:mb-3 block px-1">
                  Order type
                </label>
                <div className="flex bg-secondary p-1 rounded-xl border border-border shadow-inner">
                  <button
                    type="button"
                    onClick={() => setAction("buy")}
                    className={cn(
                      "flex-1 text-xs font-semibold normal-case tracking-normal rounded-xl py-3 transition-all",
                      action === "buy"
                        ? "bg-primary text-primary-foreground shadow-none shadow-primary/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5",
                    )}
                  >
                    Buy
                  </button>
                  <button
                    type="button"
                    onClick={() => setAction("sell")}
                    className={cn(
                      "flex-1 text-xs font-semibold normal-case tracking-normal rounded-xl py-3 transition-all",
                      action === "sell"
                        ? "bg-destructive text-destructive-foreground shadow-none shadow-destructive/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5",
                    )}
                  >
                    Sell
                  </button>
                </div>
              </div>

              <div className="col-span-1 md:col-span-1">
                <label
                  htmlFor="trade-amount"
                  className="text-xs font-semibold tracking-normal text-muted-foreground normal-case mb-2 sm:mb-3 block px-1"
                >
                  Quantity
                </label>
                <div className="relative group">
                  <input
                    id="trade-amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    className="w-full bg-secondary/80 border border-border rounded-xl px-5 py-3.5 text-foreground text-sm font-semibold placeholder:text-muted-foreground/30 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all tabular-nums"
                  />
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-3 pointer-events-none opacity-80">
                    <div className="h-4 w-[1px] bg-border" />
                    <span className="text-[11px] font-semibold text-muted-foreground normal-case tracking-normal leading-none">
                      {company.symbol.split(":")[1] || company.symbol}
                    </span>
                  </div>
                  <div className="absolute inset-0 bg-primary/5 opacity-0 group-focus-within:opacity-100 transition-opacity rounded-xl pointer-events-none" />
                </div>
              </div>

              <div className="col-span-1 md:col-span-1">
                <div className="bg-secondary/40 border border-border rounded-xl p-3 sm:p-4 flex flex-col justify-between h-[48px] sm:h-[52px]">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-semibold text-muted-foreground normal-case tracking-normal opacity-60">
                      Estimated Cost
                    </span>
                    <motion.span
                      key={cost}
                      initial={{ scale: 0.95, opacity: 0.5 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={cn(
                        "font-mono font-semibold text-sm tabular-nums truncate max-w-[120px]",
                        action === "buy"
                          ? canAfford
                            ? "text-foreground"
                            : "text-destructive"
                          : canSell
                            ? "text-foreground"
                            : "text-destructive",
                      )}
                    >
                      {formatAmount(cost)}
                    </motion.span>
                  </div>
                  <div className="w-full h-1 bg-border rounded-full overflow-hidden mt-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width:
                          cost > 0
                            ? (action === "buy"
                                ? Math.min(100, (cost / user.eTokens) * 100)
                                : 100) + "%"
                            : 0,
                      }}
                      className={cn(
                        "h-full transition-colors",
                        action === "buy"
                          ? canAfford
                            ? "bg-primary"
                            : "bg-destructive"
                          : "bg-primary",
                      )}
                    />
                  </div>
                </div>
              </div>

              <div className="col-span-1 md:col-span-1">
                <button
                  type="submit"
                  disabled={disabled}
                  className={cn(
                    "w-full py-4 rounded-xl font-semibold text-xs normal-case tracking-normal transition-all relative overflow-hidden group shadow-none",
                    action === "buy"
                      ? "bg-primary text-primary-foreground"
                      : "bg-destructive text-destructive-foreground",
                    disabled
                      ? "opacity-30 cursor-not-allowed grayscale"
                      : " active:scale-[0.98] ",
                  )}
                >
                  <div className="flex items-center justify-center gap-3 relative z-10">
                    {loading ? (
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        {action === "buy" ? (
                          <Activity size={14} />
                        ) : (
                          <TrendingUp size={14} />
                        )}
                        {action === "buy" ? "Buy shares" : "Sell shares"}
                        <ArrowRight
                          size={14}
                          className="group-hover:translate-x-1.5 transition-transform"
                        />
                      </>
                    )}
                  </div>
                </button>
              </div>
            </div>
          </form>
        </div>
      </>
    );
  },
);

export default TradePanel;
