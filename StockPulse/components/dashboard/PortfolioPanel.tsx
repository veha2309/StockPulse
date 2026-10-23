import { useState, useEffect, useRef, memo } from "react";
import { postJSON } from "@/lib/http";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet,
  History,
  TrendingUp,
  Target,
  Eye,
  ShoppingCart,
  X,
  ChevronRight,
  TrendingDown,
  Plus,
} from "lucide-react";
import { COMPANIES } from "@/lib/constants";
import { cn } from "@/lib/utils";

import type {
  UserData,
  TradeRecord,
  OptionTradeRecord,
  OptionPosition,
  Quote,
} from "@/lib/types";

type PanelTab = "holdings" | "history";

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(ts: string) {
  const d = new Date(ts);
  return (
    d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) +
    " " +
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
  );
}

const PortfolioPanel = memo(
  ({
    user,
    onClose,
    onSelectCompany,
    onFocusSell,
    onUserUpdate,
    onRechargeOpen,
  }: {
    user: UserData;
    onClose?: () => void;
    onSelectCompany?: (symbol: string) => void;
    onFocusSell?: () => void;
    onUserUpdate?: (user: UserData) => void;
    onRechargeOpen?: () => void;
  }) => {
    const pendingTargets = useRef(new Set<string>());
    const [actionError, setActionError] = useState("");
    const [tab, setTab] = useState<PanelTab>("holdings");
    const [trades, setTrades] = useState<TradeRecord[]>([]);
    const [optionTrades, setOptionTrades] = useState<OptionTradeRecord[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [livePrices, setLivePrices] = useState<Record<string, number>>({});

    const [targetingSymbol, setTargetingSymbol] = useState<string | null>(null);
    const [targetSl, setTargetSl] = useState("");
    const [targetTp, setTargetTp] = useState("");
    const [updatingTarget, setUpdatingTarget] = useState(false);

    const [viewingSymbol, setViewingSymbol] = useState<string | null>(null);
    const [viewingQuote, setViewingQuote] = useState<any>(null);
    const [viewingLoading, setViewingLoading] = useState(false);

    const [sellingOption, setSellingOption] = useState<OptionPosition | null>(
      null,
    );
    const [sellingLots, setSellingLots] = useState(1);
    const [sellingPremium, setSellingPremium] = useState<number | null>(null);
    const [fetchingPremium, setFetchingPremium] = useState(false);
    const [processingSale, setProcessingSale] = useState(false);

    useEffect(() => {
      if (tab !== "holdings" || !user.portfolio || user.portfolio.length === 0)
        return;

      let active = true;
      const controller = new AbortController();
      const fetchPrices = async () => {
        const symbols = user.portfolio!.map((p) => p.symbol).join(",");
        try {
          const res = await fetch(
            `/api/quotes?symbols=${encodeURIComponent(symbols)}`,
            { signal: controller.signal },
          );
          if (res.ok) {
            const data = await res.json();
            if (!active) return;
            setLivePrices(data);

            for (const item of user.portfolio!) {
              const price = data[item.symbol];
              if (!price) continue;

              let shouldSell = false;
              let triggerType = "";

              if (item.sl && price <= item.sl) {
                shouldSell = true;
                triggerType = "Stop Loss";
              }
              if (item.tp && price >= item.tp) {
                shouldSell = true;
                triggerType = "Take Profit";
              }

              if (shouldSell && !pendingTargets.current.has(item.symbol)) {
                pendingTargets.current.add(item.symbol);
                fetch("/api/trade", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    email: user.email,
                    action: "sell",
                    symbol: item.symbol,
                    amount: item.amount,
                    price: price,
                    tradeType: "equity",
                    trigger: true,
                  }),
                })
                  .then((r) => r.json())
                  .then((resData) => {
                    if (resData.user && onUserUpdate)
                      onUserUpdate(resData.user);
                  })
                  .catch(console.error)
                  .finally(() => pendingTargets.current.delete(item.symbol));
              }
            }
          }
        } catch (err) {
          console.error("Failed to fetch live prices", err);
        }
      };

      let intervalId: any = null;

      const startInterval = () => {
        fetchPrices();
        if (intervalId) clearInterval(intervalId);
        intervalId = setInterval(fetchPrices, 15000);
      };

      const stopInterval = () => {
        if (intervalId) clearInterval(intervalId);
      };

      const handleVisibility = () => {
        if (document.hidden) {
          stopInterval();
        } else {
          startInterval();
        }
      };

      if (!document.hidden) {
        startInterval();
      }

      document.addEventListener("visibilitychange", handleVisibility);

      return () => {
        active = false;
        controller.abort();
        stopInterval();
        document.removeEventListener("visibilitychange", handleVisibility);
      };
    }, [user.portfolio, tab, user.email, onUserUpdate]);

    useEffect(() => {
      if (tab !== "history") return;
      setHistoryLoading(true);
      fetch(`/api/history?email=${encodeURIComponent(user.email)}`)
        .then((r) => r.json())
        .then((data) => {
          setTrades(data.trades ?? []);
          setOptionTrades(data.optionTrades ?? []);
          setHistoryLoading(false);
        })
        .catch(() => setHistoryLoading(false));
    }, [tab, user.email]);

    const options = user.options ?? [];

    let totalInvested = 0;
    let totalCurrentValue = 0;

    (user.portfolio ?? []).forEach((item) => {
      const invested = item.amount * item.avgBuyPrice;
      totalInvested += invested;
      const currentPrice = livePrices[item.symbol] ?? item.avgBuyPrice;
      totalCurrentValue += item.amount * currentPrice;
    });

    const totalPnL = totalCurrentValue - totalInvested;
    const totalPnLPct =
      totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
    const isPnLPositive = totalPnL >= 0;

    function handleActionClick(
      symbol: string,
      action: "view" | "sell" | "targets",
    ) {
      setActionError("");
      if (action === "targets") {
        const item = user.portfolio?.find((p) => p.symbol === symbol);
        setTargetingSymbol(symbol);
        setTargetSl(item?.sl ? item.sl.toString() : "");
        setTargetTp(item?.tp ? item.tp.toString() : "");
        return;
      }

      if (action === "view") {
        setViewingSymbol(symbol);
        setViewingLoading(true);
        fetch(`/api/stock?symbol=${symbol}`)
          .then((r) => r.json())
          .then((data) => {
            setViewingQuote(data.quote);
            setViewingLoading(false);
          })
          .catch(() => setViewingLoading(false));
        return;
      }

      if (onSelectCompany) onSelectCompany(symbol);
      if (action === "sell" && onFocusSell) {
        setTimeout(() => onFocusSell(), 100);
      }
      if (onClose) onClose();
    }

    async function handleActionOption(
      pos: OptionPosition,
      action: "view" | "sell",
    ) {
      if (action === "view") {
        setViewingSymbol(pos.underlyingSymbol);
        setViewingLoading(true);
        fetch(`/api/stock?symbol=${pos.underlyingSymbol}`)
          .then((r) => r.json())
          .then((data) => {
            setViewingQuote(data.quote);
            setViewingLoading(false);
          })
          .catch(() => setViewingLoading(false));
        return;
      }

      if (action === "sell") {
        setActionError("");
        setSellingPremium(null);
        setSellingOption(pos);
        setSellingLots(pos.lots);
        setFetchingPremium(true);

        try {
          const params = new URLSearchParams({
            symbol: pos.underlyingSymbol,
            contract: pos.contractSymbol,
            strike: String(pos.strike),
            expiration: String(pos.expiration),
            type: pos.type,
          });
          const res = await fetch("/api/options?" + params.toString());
          const data = await res.json();
          const contract = data.contract;
          if (
            !res.ok ||
            !contract ||
            contract.contractSymbol !== pos.contractSymbol
          )
            throw new Error(
              "Current quote for this exact contract is unavailable",
            );
          setSellingPremium(contract.lastPrice);
        } catch {
          setSellingPremium(null);
          setActionError(
            "A quote for this contract is unavailable. Sale was not placed.",
          );
        } finally {
          setFetchingPremium(false);
        }
      }
    }

    async function confirmOptionSell() {
      if (!sellingOption || !sellingPremium) return;
      setProcessingSale(true);
      setActionError("");
      try {
        const data = await postJSON<{ user: UserData }>("/api/trade", {
          email: user.email,
          tradeType: "option",
          action: "sell",
          contractSymbol: sellingOption.contractSymbol,
          positionId: sellingOption.id,
          underlyingSymbol: sellingOption.underlyingSymbol,
          optionType: sellingOption.type,
          strike: sellingOption.strike,
          expiration: sellingOption.expiration,
          lots: sellingLots,
        });
        if (data.user && onUserUpdate) onUserUpdate(data.user);
        setSellingOption(null);
      } catch (err) {
        console.error(err);
        setActionError(
          err instanceof Error
            ? err.message
            : "Request failed. Please try again.",
        );
      } finally {
        setProcessingSale(false);
      }
    }

    async function saveTargets(symbol: string) {
      setUpdatingTarget(true);
      setActionError("");
      try {
        const res = await fetch("/api/targets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: user.email,
            symbol,
            sl: targetSl ? parseFloat(targetSl) : null,
            tp: targetTp ? parseFloat(targetTp) : null,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.user)
          throw new Error(data.error || "Unable to save targets");
        if (data.user && onUserUpdate) onUserUpdate(data.user);
        setTargetingSymbol(null);
      } catch (err) {
        console.error(err);
        setActionError(
          err instanceof Error
            ? err.message
            : "Request failed. Please try again.",
        );
      }
      setUpdatingTarget(false);
    }

    return (
      <div className="relative z-10 w-full h-full flex flex-col bg-card">
        {actionError && (
          <p
            role="alert"
            className="relative z-[60] bg-card text-destructive text-xs p-3 border-b border-border"
          >
            {actionError}
          </p>
        )}
        {/* Header */}
        <div className="px-5 py-5 border-b border-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Wallet size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Portfolio</h2>
              <p className="text-xs text-muted-foreground normal-case font-bold tracking-normal mt-0.5">
                Positions & activity
              </p>
            </div>
          </div>
          {onClose && (
            <button
              aria-label="Close panel"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {(user.portfolio ?? []).some((p) => !livePrices[p.symbol]) && (
          <p className="px-5 py-2 text-xs text-muted-foreground">
            Some quotes are unavailable; estimates use entry prices.
          </p>
        )}
        {/* Balance & PnL Header */}
        <div className="px-6 py-6 border-b border-border flex-shrink-0 bg-background/40">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="surface rounded-xl p-3 border-border">
              <div className="flex justify-between items-center gap-1.5 min-w-0">
                <p className="text-[11px] font-semibold normal-case tracking-normal text-muted-foreground opacity-60 mb-1.5">
                  Available Funds
                </p>
                <button
                  onClick={onRechargeOpen}
                  className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all active:scale-90 flex-shrink-0"
                  title="Recharge Tokens"
                >
                  <Plus size={12} strokeWidth={3} />
                </button>
              </div>
              <h3 className="text-sm font-mono font-semibold text-foreground tabular-nums tracking-tight min-w-0 flex-1 break-all leading-tight pt-2">
                {fmt(user.eTokens)}
              </h3>
            </div>
            <div className="surface rounded-xl p-3 border-border">
              <p className="text-[11px] font-bold tracking-normal text-muted-foreground normal-case mb-1.5">
                Holdings value
              </p>
              <p className="text-sm font-semibold text-foreground tracking-tight tabular-nums break-all leading-tight">
                {fmt(totalCurrentValue)}
              </p>
            </div>
          </div>

          <div
            className={cn(
              "flex justify-between items-center p-4 rounded-xl border border-border shadow-none",
              totalPnL >= 0
                ? "bg-emerald-500/5 border-emerald-500/10"
                : "bg-red-500/5 border-red-500/10",
            )}
          >
            <div>
              <p className="text-[11px] text-muted-foreground font-bold normal-case tracking-normal mb-1">
                Unrealized P&L
              </p>
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                {totalPnL !== 0 && (
                  <span
                    className={cn(
                      "p-1 rounded-lg flex-shrink-0",
                      isPnLPositive
                        ? "bg-emerald-500/20 text-emerald-500"
                        : "bg-red-500/20 text-red-500",
                    )}
                  >
                    {isPnLPositive ? (
                      <TrendingUp size={12} />
                    ) : (
                      <TrendingDown size={12} />
                    )}
                  </span>
                )}
                <p
                  className={cn(
                    "text-base font-semibold font-mono min-w-0 leading-tight",
                    totalPnL === 0
                      ? "text-muted-foreground"
                      : isPnLPositive
                        ? "text-emerald-500"
                        : "text-red-500",
                  )}
                >
                  {totalPnL > 0 ? "+" : ""}
                  {fmt(totalPnL)}
                  {totalInvested > 0 && (
                    <span className="text-xs font-semibold ml-1.5 opacity-70">
                      ({totalPnLPct > 0 ? "+" : ""}
                      {totalPnLPct.toFixed(2)}%)
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground font-bold normal-case tracking-normal mb-1">
                Invested
              </p>
              <p className="text-sm text-foreground font-bold font-mono">
                {fmt(totalInvested)}
              </p>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-border bg-background/20 flex-shrink-0 p-1 mx-6 my-4 rounded-xl surface">
          <button
            onClick={() => setTab("holdings")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold normal-case tracking-normal rounded-lg transition-all",
              tab === "holdings"
                ? "bg-primary text-primary-foreground shadow-none shadow-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            <Wallet size={14} /> Holdings
          </button>
          <button
            onClick={() => setTab("history")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold normal-case tracking-normal rounded-lg transition-all",
              tab === "history"
                ? "bg-primary text-primary-foreground shadow-none shadow-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            <History size={14} /> History
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          {tab === "holdings" && (
            <div className="py-2 px-6">
              <p className="text-xs font-bold tracking-normal text-muted-foreground normal-case mb-4 mt-2">
                Equity Assets ({(user.portfolio ?? []).length})
              </p>
              {(user.portfolio ?? []).length > 0 ? (
                <div className="space-y-4">
                  {(user.portfolio ?? []).map((item, idx) => {
                    const currentPrice =
                      livePrices[item.symbol] ?? item.avgBuyPrice;
                    const invested = item.amount * item.avgBuyPrice;
                    const currentValue = item.amount * currentPrice;
                    const pnl = currentValue - invested;
                    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
                    const isItemPositive = pnl >= 0;

                    return (
                      <motion.div
                        key={item.symbol}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                      >
                        <div>
                          <div className="group surface rounded-xl p-4 transition-all relative overflow-hidden border-border hover:border-primary/30">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-sm font-bold text-foreground">
                                  {COMPANIES.find(
                                    (c) => c.symbol === item.symbol,
                                  )?.name ?? item.symbol}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span
                                    className={cn(
                                      "text-[11px] font-bold px-1.5 py-0.5 rounded",
                                      isItemPositive
                                        ? "bg-emerald-500/10 text-emerald-500"
                                        : "bg-red-500/10 text-red-500",
                                    )}
                                  >
                                    {isItemPositive ? "Gain" : "Loss"}
                                  </span>
                                  <p className="text-xs text-muted-foreground font-mono">
                                    {item.amount} shares @{" "}
                                    {fmt(item.avgBuyPrice)}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-foreground font-mono">
                                  {fmt(currentValue)}
                                </p>
                                <p
                                  className={cn(
                                    "text-xs font-bold font-mono mt-1",
                                    pnl === 0
                                      ? "text-muted-foreground"
                                      : isItemPositive
                                        ? "text-emerald-500"
                                        : "text-red-500",
                                  )}
                                >
                                  {pnl > 0 ? "+" : ""}
                                  {fmt(pnl)}
                                  <span className="opacity-70 ml-1">
                                    ({pnlPct > 0 ? "+" : ""}
                                    {pnlPct.toFixed(2)}%)
                                  </span>
                                </p>
                              </div>
                            </div>

                            {(item.sl || item.tp) && (
                              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/50 text-[11px] font-bold normal-case tracking-normal">
                                {item.tp && (
                                  <span className="text-primary flex items-center gap-1">
                                    <Target size={10} /> TP: {fmt(item.tp)}
                                  </span>
                                )}
                                {item.sl && (
                                  <span className="text-amber-500 flex items-center gap-1">
                                    <History size={10} /> SL: {fmt(item.sl)}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Action buttons — always visible, not hover-only (touch screens have no hover) */}
                            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/40">
                              <button
                                onClick={() =>
                                  handleActionClick(item.symbol, "targets")
                                }
                                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-bold text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 rounded-xl transition-all border border-amber-500/20"
                              >
                                <Target size={11} /> Targets
                              </button>
                              <button
                                onClick={() =>
                                  handleActionClick(item.symbol, "view")
                                }
                                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-all border border-primary/20"
                              >
                                <Eye size={11} /> Details
                              </button>
                              <button
                                onClick={() =>
                                  handleActionClick(item.symbol, "sell")
                                }
                                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-bold text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-all border border-red-500/20"
                              >
                                <ShoppingCart size={11} /> Exit
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 surface rounded-xl border-dashed text-center">
                  <p className="text-muted-foreground text-xs font-bold normal-case tracking-normal">
                    No Active Positions
                  </p>
                </div>
              )}

              <p className="text-xs font-bold tracking-normal text-muted-foreground normal-case mb-4 mt-8">
                Derivative Contracts ({options.length})
              </p>
              {options.length > 0 ? (
                <div className="space-y-3">
                  {options.map((pos, idx) => (
                    <motion.div
                      key={pos.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      className="group surface rounded-xl p-4 border-border hover:border-primary/20 transition-all"
                    >
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-[11px] font-bold px-2 py-0.5 rounded-lg border",
                              pos.type === "call"
                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                : "bg-red-500/10 text-red-500 border-red-500/20",
                            )}
                          >
                            {pos.type.toUpperCase()}
                          </span>
                          <p className="text-xs font-bold text-foreground">
                            ₹{pos.strike.toLocaleString()} Strike
                          </p>
                        </div>
                        <p className="text-[11px] font-mono font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {pos.lots} LOT{pos.lots > 1 ? "S" : ""}
                        </p>
                      </div>
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-[11px] text-muted-foreground font-bold normal-case tracking-wider mb-1">
                            Underlying
                          </p>
                          <p className="text-xs font-bold text-foreground">
                            {pos.underlyingSymbol}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] text-muted-foreground font-bold normal-case tracking-wider mb-1">
                            Buy Premium
                          </p>
                          <p className="text-xs font-mono font-bold text-foreground">
                            {fmt(pos.premium)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-border/50 flex justify-between items-center">
                        <p className="text-[11px] text-muted-foreground font-bold normal-case tracking-normal italic">
                          Expires{" "}
                          {(() => {
                            const d = new Date(pos.expiration * 1000);
                            const months = [
                              "Jan",
                              "Feb",
                              "Mar",
                              "Apr",
                              "May",
                              "Jun",
                              "Jul",
                              "Aug",
                              "Sep",
                              "Oct",
                              "Nov",
                              "Dec",
                            ];
                            return `${String(d.getDate()).padStart(2, "0")}-${months[d.getMonth()]}-${d.getFullYear()}`;
                          })()}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleActionOption(pos, "view")}
                            className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-all"
                          >
                            <Eye size={12} />
                          </button>
                          <button
                            onClick={() => handleActionOption(pos, "sell")}
                            className="px-3 py-1.5 text-xs font-bold text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-lg border border-red-500/20 transition-all"
                          >
                            Exit Position
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 surface rounded-xl border-dashed text-center">
                  <p className="text-muted-foreground text-xs font-bold normal-case tracking-normal">
                    No Active Options
                  </p>
                </div>
              )}
            </div>
          )}

          {tab === "history" && (
            <div className="py-2">
              {historyLoading ? (
                <div className="flex items-center justify-center py-12 gap-2">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-muted-foreground text-xs">
                    Loading history...
                  </p>
                </div>
              ) : (
                <>
                  {trades.length > 0 && (
                    <>
                      <p className="text-xs font-semibold tracking-normal text-muted-foreground normal-case px-5 mt-2 mb-1">
                        Equity Trades
                      </p>
                      {trades.map((t) => (
                        <div
                          key={t._id}
                          className="px-5 py-2.5 border-b border-border hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "text-[10px] font-bold px-1.5 py-0.5 rounded",
                                  t.action === "buy"
                                    ? "bg-emerald-500/20 text-emerald-500"
                                    : "bg-red-500/20 text-red-500",
                                )}
                              >
                                {t.action.toUpperCase()}
                              </span>
                              <p className="text-xs font-bold text-foreground">
                                {COMPANIES.find((c) => c.symbol === t.symbol)
                                  ?.name ?? t.symbol}
                              </p>
                            </div>
                            <p className="text-xs font-mono font-bold text-foreground">
                              {fmt(t.total)}
                            </p>
                          </div>
                          <div className="flex justify-between items-center mt-1">
                            <p className="text-xs text-muted-foreground font-medium">
                              {t.amount} shares @ {fmt(t.price)}
                            </p>
                            <p className="text-xs text-muted-foreground font-medium">
                              {fmtDate(t.timestamp)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {optionTrades.length > 0 && (
                    <>
                      <p className="text-xs font-semibold tracking-normal text-muted-foreground normal-case px-5 mt-3 mb-1">
                        Option Trades
                      </p>
                      {optionTrades.map((t) => (
                        <div
                          key={t._id}
                          className="px-5 py-2.5 border-b border-border hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "text-[10px] font-bold px-1.5 py-0.5 rounded",
                                  t.action === "buy"
                                    ? "bg-emerald-500/20 text-emerald-500"
                                    : "bg-red-500/20 text-red-500",
                                )}
                              >
                                {t.action.toUpperCase()}
                              </span>
                              <span
                                className={cn(
                                  "text-xs font-bold px-1.5 py-0.5 rounded ml-1",
                                  t.optionType === "call"
                                    ? "bg-primary/20 text-primary border border-primary/20"
                                    : "bg-destructive/20 text-destructive border border-destructive/20",
                                )}
                              >
                                {t.optionType.toUpperCase()}
                              </span>
                              <p className="text-xs font-bold text-foreground">
                                ₹{t.strike.toLocaleString()}
                              </p>
                            </div>
                            <p className="text-xs font-mono font-bold text-foreground">
                              {fmt(t.total)}
                            </p>
                          </div>
                          <div className="flex justify-between items-center mt-1">
                            <p className="text-xs text-muted-foreground font-medium">
                              {t.lots} lot{t.lots > 1 ? "s" : ""} @{" "}
                              {fmt(t.premium)} · {t.underlyingSymbol}
                            </p>
                            <p className="text-xs text-muted-foreground font-medium">
                              {fmtDate(t.timestamp)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {trades.length === 0 && optionTrades.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                      <span className="text-3xl">📋</span>
                      <p className="text-muted-foreground text-xs mt-1">
                        No trades yet.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <AnimatePresence>
          {targetingSymbol && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="surface rounded-[2rem] border border-border shadow-none w-full max-w-sm p-8 relative"
              >
                <button
                  onClick={() => setTargetingSymbol(null)}
                  className="absolute top-6 right-6 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={20} />
                </button>
                <h3 className="text-foreground font-semibold text-xl mb-1 tracking-tight">
                  {COMPANIES.find((c) => c.symbol === targetingSymbol)?.name ||
                    targetingSymbol}
                </h3>
                <p className="text-xs text-muted-foreground font-bold normal-case tracking-normal mb-6 px-1">
                  Targets execute only while this workspace is open.
                </p>

                <div className="space-y-6 mb-8 mt-2">
                  <div>
                    <label className="text-xs normal-case font-bold tracking-normal text-primary mb-2 block px-1">
                      Take Profit (Target)
                    </label>
                    <div className="relative group">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground group-focus-within:text-primary transition-colors">
                        ₹
                      </span>
                      <input
                        type="number"
                        value={targetTp}
                        onChange={(e) => setTargetTp(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-secondary/50 border border-border rounded-xl pl-8 pr-4 py-3 text-sm text-foreground font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs normal-case font-bold tracking-normal text-amber-500 mb-2 block px-1">
                      Stop Loss (Protection)
                    </label>
                    <div className="relative group">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground group-focus-within:text-amber-500 transition-colors">
                        ₹
                      </span>
                      <input
                        type="number"
                        value={targetSl}
                        onChange={(e) => setTargetSl(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-secondary/50 border border-border rounded-xl pl-8 pr-4 py-3 text-sm text-foreground font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <button
                  disabled={updatingTarget}
                  onClick={() => saveTargets(targetingSymbol)}
                  className="w-full py-4 bg-primary text-primary-foreground text-xs font-bold rounded-xl transition-all shadow-none shadow-primary/20  active:scale-95 disabled:opacity-80"
                >
                  {updatingTarget ? "Updating Account..." : "Save targets"}
                </button>
              </motion.div>
            </motion.div>
          )}

          {viewingSymbol && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="surface border border-border shadow-none rounded-[2rem] w-full max-w-sm overflow-hidden relative"
              >
                <button
                  onClick={() => {
                    setViewingSymbol(null);
                    setViewingQuote(null);
                  }}
                  className="absolute top-6 right-6 text-muted-foreground hover:text-foreground transition-colors z-10"
                >
                  <X size={20} />
                </button>

                {viewingLoading ? (
                  <div className="py-24 flex flex-col items-center justify-center gap-4 text-center">
                    <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs font-bold text-muted-foreground normal-case tracking-normal">
                      Fetching Node Analytics...
                    </p>
                  </div>
                ) : viewingQuote ? (
                  <div className="p-8">
                    <div className="mb-8">
                      <h3 className="text-xl font-semibold text-foreground leading-tight tracking-tight">
                        {COMPANIES.find((c) => c.symbol === viewingSymbol)
                          ?.name || viewingSymbol}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                          {viewingSymbol}
                        </span>
                        <p className="text-xs text-muted-foreground font-bold normal-case tracking-wider">
                          {COMPANIES.find((c) => c.symbol === viewingSymbol)
                            ?.sector ?? "Equities"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                      <div className="bg-secondary/50 p-4 rounded-xl border border-border">
                        <p className="text-[11px] text-muted-foreground font-bold normal-case tracking-normal mb-1.5 leading-none">
                          Market Price
                        </p>
                        <p className="text-xl font-semibold text-foreground tabular-nums tracking-normal">
                          ₹
                          {viewingQuote.c?.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                        <p
                          className={cn(
                            "text-xs font-bold mt-1.5 flex items-center gap-1",
                            viewingQuote.d >= 0
                              ? "text-emerald-500"
                              : "text-red-500",
                          )}
                        >
                          {viewingQuote.d >= 0 ? "▲" : "▼"}{" "}
                          {Math.abs(viewingQuote.dp ?? 0).toFixed(2)}%
                        </p>
                      </div>
                      <div className="bg-secondary/50 p-4 rounded-xl border border-border">
                        <p className="text-[11px] text-muted-foreground font-bold normal-case tracking-normal mb-1.5 leading-none">
                          Prev. Session
                        </p>
                        <p className="text-xl font-semibold text-muted-foreground/80 tabular-nums tracking-normal">
                          ₹
                          {viewingQuote.pc?.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4 mb-8">
                      <div className="flex justify-between items-center text-xs py-2 border-b border-border">
                        <span className="text-muted-foreground font-bold normal-case tracking-normal">
                          Day High
                        </span>
                        <span className="text-emerald-500 font-mono font-semibold">
                          ₹
                          {viewingQuote.h?.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs py-2 border-b border-border">
                        <span className="text-muted-foreground font-bold normal-case tracking-normal">
                          Day Low
                        </span>
                        <span className="text-red-500 font-mono font-semibold">
                          ₹
                          {viewingQuote.l?.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs py-2 border-b border-border">
                        <span className="text-muted-foreground font-bold normal-case tracking-normal">
                          Open
                        </span>
                        <span className="text-foreground font-mono font-semibold">
                          ₹
                          {viewingQuote.o?.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (onSelectCompany) onSelectCompany(viewingSymbol);
                        setViewingSymbol(null);
                        if (onClose) onClose();
                      }}
                      className="w-full py-4 bg-foreground text-background  active:scale-95 text-xs font-semibold normal-case tracking-normal rounded-xl transition-all shadow-none"
                    >
                      Go to Chart
                    </button>
                  </div>
                ) : null}
              </motion.div>
            </motion.div>
          )}

          {sellingOption && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="surface border border-border shadow-none rounded-[2rem] w-full max-w-sm p-8 relative"
              >
                <button
                  onClick={() => setSellingOption(null)}
                  className="absolute top-6 right-6 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={20} />
                </button>

                <div className="flex items-center gap-3 mb-2">
                  <span
                    className={cn(
                      "text-[9px] font-bold px-2 py-0.5 rounded-lg border",
                      sellingOption.type === "call"
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                        : "bg-destructive/10 text-destructive border-destructive/20",
                    )}
                  >
                    {sellingOption.type.toUpperCase()}
                  </span>
                  <h3 className="text-xl font-semibold text-foreground tracking-tight">
                    Liquidate Position
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground font-bold normal-case tracking-normal mb-8 px-1">
                  Verify Output Parameters
                </p>

                <div className="space-y-6 mb-8 mt-2">
                  <div>
                    <label className="text-xs text-muted-foreground normal-case tracking-normal font-semibold mb-3 block px-1 text-center">
                      Batch Lots (Max: {sellingOption.lots})
                    </label>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() =>
                          setSellingLots(Math.max(1, sellingLots - 1))
                        }
                        className="w-12 h-12 rounded-xl bg-secondary/50 border border-border text-foreground hover:bg-muted transition-all active:scale-90"
                      >
                        -
                      </button>
                      <div className="flex-1 bg-secondary/50 border border-border rounded-xl py-3 text-center text-sm text-foreground font-semibold">
                        {sellingLots}
                      </div>
                      <button
                        onClick={() =>
                          setSellingLots(
                            Math.min(sellingOption.lots, sellingLots + 1),
                          )
                        }
                        className="w-12 h-12 rounded-xl bg-secondary/50 border border-border text-foreground hover:bg-muted transition-all active:scale-90"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="bg-secondary/50 p-6 rounded-[1.5rem] border border-border space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-muted-foreground normal-case tracking-normal">
                        Entry Premium
                      </span>
                      <span className="text-xs font-mono font-bold text-foreground">
                        {fmt(sellingOption.premium)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-4 border-t border-border/50">
                      <span className="text-xs font-bold text-muted-foreground normal-case tracking-normal">
                        Market Premium
                      </span>
                      <span
                        className={cn(
                          "text-xs font-mono font-semibold",
                          fetchingPremium
                            ? "text-muted-foreground animate-pulse"
                            : "text-emerald-500",
                        )}
                      >
                        {fetchingPremium
                          ? "Scanning..."
                          : fmt(sellingPremium ?? 0)}
                      </span>
                    </div>
                    <div className="pt-4 border-t border-border/50 flex justify-between items-center">
                      <span className="text-sm text-foreground font-semibold normal-case tracking-normal">
                        Total Credit
                      </span>
                      <span
                        className={cn(
                          "text-sm font-mono font-semibold",
                          (sellingPremium ?? 0) >= sellingOption.premium
                            ? "text-emerald-500"
                            : "text-destructive",
                        )}
                      >
                        {fmt((sellingPremium ?? 0) * (sellingLots || 0))}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  disabled={fetchingPremium || processingSale}
                  onClick={confirmOptionSell}
                  className="w-full py-4 bg-destructive text-destructive-foreground  active:scale-95 disabled:opacity-80 text-xs font-semibold normal-case tracking-normal rounded-xl transition-all shadow-none shadow-destructive/20"
                >
                  {processingSale
                    ? "Transmitting..."
                    : `Execute Liquidate Order`}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="px-6 py-6 border-t border-border flex-shrink-0 bg-background/40">
          <p className="text-xs text-muted-foreground font-bold text-center normal-case tracking-normal">
            Virtual portfolio · Values in INR
          </p>
        </div>
      </div>
    );
  },
);

export default PortfolioPanel;
