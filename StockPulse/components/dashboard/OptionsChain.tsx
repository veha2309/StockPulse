import { postJSON } from "@/lib/http";
import { useState, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Info,
  Calendar,
  Target,
  ShoppingCart,
  X,
  TrendingUp,
  ChevronDown,
  Monitor,
} from "lucide-react";
import Toast from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import type { OptionContract, UserData, ToastData, Company } from "@/lib/types";
import { formatAmount } from "@/lib/format";

type Tab = "calls" | "puts";

function fmt(n: number) {
  return Number.isFinite(n) ? formatAmount(n) : "—";
}

const ContractRow = memo(
  ({
    c,
    type,
    underlyingPrice,
    onSelect,
    disabled,
    idx,
  }: {
    c: OptionContract;
    type: Tab;
    underlyingPrice: number;
    onSelect: (c: OptionContract, t: Tab) => void;
    disabled: boolean;
    idx: number;
  }) => {
    const itm =
      type === "calls"
        ? c.strike < underlyingPrice
        : c.strike > underlyingPrice;
    return (
      <motion.tr
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(idx * 0.01, 0.3) }}
        onClick={() => !disabled && onSelect(c, type)}
        style={{ willChange: "transform, opacity", transform: "translateZ(0)" }}
        className={cn(
          "border-b border-border text-sm transition-all relative group",
          disabled
            ? "opacity-80 cursor-not-allowed"
            : "cursor-pointer hover:bg-primary/5",
          itm &&
            (type === "calls"
              ? "bg-emerald-500/5 dark:bg-emerald-500/10 shadow-[inset_4px_0_0_0_#10b981]"
              : "bg-destructive/5 dark:bg-destructive/10 shadow-[inset_4px_0_0_0_#ef4444]"),
        )}
      >
        <td
          className={cn(
            "px-3 py-2 font-mono font-semibold",
            itm
              ? type === "calls"
                ? "text-emerald-500"
                : "text-destructive"
              : "text-foreground",
          )}
        >
          ₹{c.strike.toLocaleString()}
        </td>
        <td className="px-3 py-2 font-mono font-bold text-foreground truncate max-w-[80px]">
          {fmt(c.lastPrice)}
        </td>
        <td className="px-3 py-2 font-mono text-muted-foreground truncate max-w-[70px]">
          {fmt(c.bid)}
        </td>
        <td className="px-3 py-2 font-mono text-muted-foreground truncate max-w-[70px]">
          {fmt(c.ask)}
        </td>
        <td
          className={cn(
            "px-3 py-2 font-mono font-bold",
            c.change >= 0 ? "text-emerald-500" : "text-destructive",
          )}
        >
          {c.change >= 0 ? "+" : ""}
          <span className="truncate">{fmt(c.change)}</span>
        </td>
        <td className="px-3 py-2 font-mono text-muted-foreground">
          {c.volume > 0 ? c.volume.toLocaleString() : "—"}
        </td>
        <td className="px-3 py-2 font-mono text-muted-foreground">
          {c.openInterest > 0 ? c.openInterest.toLocaleString() : "—"}
        </td>
        <td className="px-3 py-2 font-mono text-muted-foreground/60 text-right">
          {c.impliedVolatility > 0
            ? (c.impliedVolatility * 100).toFixed(1) + "%"
            : "—"}
        </td>
      </motion.tr>
    );
  },
);

function BuyModal({
  contract,
  optionType,
  underlyingSymbol,
  user,
  onClose,
  onSuccess,
}: {
  contract: OptionContract;
  optionType: Tab;
  underlyingSymbol: string;
  user: UserData;
  onClose: () => void;
  onSuccess: (u: UserData) => void;
}) {
  const [lots, setUnits] = useState("1");
  const [action, setAction] = useState<"buy" | "sell">("buy");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const premium = contract.lastPrice || (contract.bid + contract.ask) / 2 || 0;
  const total = parseFloat(lots || "0") * premium;
  const ownedUnits = (user.options ?? [])
    .filter(
      (o) => o.contractSymbol === contract.contractSymbol && o.side === "buy",
    )
    .reduce((sum, p) => sum + p.lots, 0);
  const existingPos = ownedUnits > 0;
  const canSell = ownedUnits >= +lots;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!Number.isSafeInteger(+lots) || +lots <= 0) {
      setError("Enter a positive whole quantity");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await postJSON<{ user: UserData }>("/api/trade", {
        tradeType: "option",
        email: user.email,
        action,
        contractSymbol: contract.contractSymbol,
        underlyingSymbol,
        optionType: optionType === "calls" ? "call" : "put",
        strike: contract.strike,
        expiration: contract.expiration,
        lots: +lots,
      });
      onSuccess(data.user);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to place option order",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-[9999] px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        className="surface rounded-xl p-8 w-full max-w-sm border-border shadow-none relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={20} />
        </button>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-lg border",
                optionType === "calls"
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                  : "bg-destructive/10 text-destructive border-destructive/20",
              )}
            >
              {optionType === "calls" ? "CALL" : "PUT"}
            </span>
            <h3 className="text-lg font-bold text-foreground">
              ₹{contract.strike.toLocaleString()} Strike
            </h3>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
            <Calendar size={12} />
            Expiry:{" "}
            {(() => {
              const d = new Date(contract.expiration * 1000);
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
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            {
              label: "LTP",
              value: fmt(contract.lastPrice),
              color: "text-foreground",
            },
            {
              label: "Bid",
              value: fmt(contract.bid),
              color: "text-muted-foreground",
            },
            {
              label: "Ask",
              value: fmt(contract.ask),
              color: "text-muted-foreground",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-secondary/50 rounded-xl py-3 px-2 border border-border/50 text-center"
            >
              <p className="text-[9px] text-muted-foreground font-bold normal-case tracking-normal mb-1">
                {item.label}
              </p>
              <p className={cn("text-xs font-mono font-bold", item.color)}>
                ₹{item.value}
              </p>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="bg-secondary/50 p-1.5 rounded-xl border border-border flex">
            <button
              type="button"
              onClick={() => setAction("buy")}
              className={cn(
                "flex-1 text-xs font-bold rounded-xl py-2.5 transition-all",
                action === "buy"
                  ? "bg-primary text-primary-foreground shadow-none shadow-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              Buy
            </button>
            <button
              type="button"
              onClick={() => setAction("sell")}
              disabled={!existingPos}
              className={cn(
                "flex-1 text-xs font-bold rounded-xl py-2.5 transition-all",
                action === "sell"
                  ? "bg-destructive text-destructive-foreground shadow-none shadow-destructive/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
                !existingPos && "opacity-30 grayscale cursor-not-allowed",
              )}
            >
              Sell
            </button>
          </div>

          <div>
            <label className="text-[10px] font-bold tracking-normal text-muted-foreground normal-case mb-2 block px-1 text-center">
              Quantity (Units)
            </label>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() =>
                  setUnits((prev) => Math.max(1, parseInt(prev) - 1).toString())
                }
                className="w-12 h-12 rounded-xl bg-secondary/50 border border-border text-foreground hover:bg-muted transition-all active:scale-90"
              >
                -
              </button>
              <input
                type="number"
                value={lots}
                onChange={(e) => setUnits(e.target.value)}
                min="1"
                className="flex-1 bg-secondary/50 border border-border rounded-xl px-4 py-3 text-center text-foreground font-bold focus:outline-none focus:border-primary transition-all"
              />
              <button
                type="button"
                onClick={() =>
                  setUnits((prev) => (parseInt(prev || "0") + 1).toString())
                }
                className="w-12 h-12 rounded-xl bg-secondary/50 border border-border text-foreground hover:bg-muted transition-all active:scale-90"
              >
                +
              </button>
            </div>
          </div>

          <div className="space-y-2 px-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground font-medium">Premium</span>
              <span className="font-mono font-bold text-foreground">
                ₹{fmt(premium)}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs pt-2 border-t border-border/50">
              <span className="text-muted-foreground font-bold normal-case tracking-normal">
                Required Funds
              </span>
              <span
                className={cn(
                  "font-mono font-semibold text-sm",
                  user.eTokens >= total
                    ? "text-emerald-500"
                    : "text-destructive",
                )}
              >
                ₹{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.p
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="text-destructive text-[10px] font-semibold normal-case tracking-normal bg-destructive/10 rounded-xl px-4 py-3 border border-destructive/20 text-center"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={loading || (action === "sell" && !canSell)}
            className={cn(
              "w-full py-4 rounded-xl font-bold text-xs normal-case tracking-normal transition-all shadow-none",
              action === "buy"
                ? "bg-primary text-primary-foreground shadow-primary/20"
                : "bg-destructive text-destructive-foreground shadow-destructive/20",
              loading || (action === "sell" && !canSell)
                ? "opacity-80 cursor-not-allowed"
                : " active:scale-[0.98]",
            )}
          >
            {loading ? (
              "Processing Order..."
            ) : (
              <div className="flex items-center justify-center gap-2">
                <ShoppingCart size={16} />
                {action === "buy" ? "Place Buy Order" : "Place Sell Order"}
              </div>
            )}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

type Props = {
  symbol: string;
  company: Company;
  user: UserData;
  underlyingPrice: number;
  onTradeSuccess: (u: UserData) => void;
};

export default function OptionsChain({
  symbol,
  company,
  user,
  underlyingPrice,
  onTradeSuccess,
}: Props) {
  const [tab, setTab] = useState<Tab>("calls");
  const [calls, setCalls] = useState<OptionContract[]>([]);
  const [puts, setPuts] = useState<OptionContract[]>([]);
  const [expiryDates, setExpiryDates] = useState<string[]>([]);
  const [selectedExpiry, setSelectedExpiry] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [marketClosed, setMarketClosed] = useState(false);
  const [selected, setSelected] = useState<{
    contract: OptionContract;
    type: Tab;
  } | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);

  useEffect(() => {
    let active = true;
    let busy = false;
    const controller = new AbortController();
    setLoading(true);
    setSelected(null);
    const refresh = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const url =
          "/api/options?symbol=" +
          encodeURIComponent(symbol) +
          (selectedExpiry
            ? "&expiry=" + encodeURIComponent(selectedExpiry)
            : "");
        const res = await fetch(url, {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = await res.json();
        if (!active) return;
        if (!res.ok) throw new Error(data.error);
        setCalls(data.calls ?? []);
        setPuts(data.puts ?? []);
        setExpiryDates(data.expiryDates ?? []);
        setMarketClosed(!!data.marketClosed);
      } catch {
        if (active) {
          setMarketClosed(true);
          setCalls([]);
          setPuts([]);
        }
      } finally {
        busy = false;
        if (active) setLoading(false);
      }
    };
    void refresh();
    const interval = setInterval(refresh, 15000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      controller.abort();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [symbol, selectedExpiry]);

  const rows = tab === "calls" ? calls : puts;
  const hasData = rows.length > 0;

  return (
    <>
      <AnimatePresence>
        {toast && (
          <Toast
            key={toast.message}
            toast={toast}
            onDone={() => setToast(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selected && !marketClosed && (
          <BuyModal
            contract={selected.contract}
            optionType={selected.type}
            underlyingSymbol={symbol}
            user={user}
            onClose={() => setSelected(null)}
            onSuccess={(u) => {
              onTradeSuccess(u);
              setSelected(null);
              setToast({ message: "Option order placed!", type: "success" });
            }}
          />
        )}
      </AnimatePresence>

      <div className="flex flex-col min-h-full bg-card">
        {/* Market closed banner */}
        <AnimatePresence>
          {marketClosed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex items-center gap-3 px-6 py-4 bg-amber-500/10 border-b border-amber-500/20 flex-shrink-0 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-transparent animate-pulse" />
              <motion.span
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="text-amber-500 text-lg relative"
              >
                🌙
              </motion.span>
              <div className="relative">
                <p className="text-amber-500 text-xs font-semibold normal-case tracking-normal leading-none mb-1">
                  Options unavailable
                </p>
                <p className="text-muted-foreground text-xs font-medium leading-none">
                  Current practice quotes could not be loaded. Try again
                  shortly.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls */}
        <div className="flex items-center gap-4 px-5 py-5 border-b border-border flex-shrink-0 flex-wrap z-10 surface">
          <div className="flex bg-secondary p-1 rounded-xl border border-border shadow-inner">
            <button
              onClick={() => setTab("calls")}
              className={cn(
                "px-8 py-2 text-xs font-semibold normal-case tracking-normal rounded-xl transition-all",
                tab === "calls"
                  ? "bg-emerald-500 text-white shadow-none shadow-emerald-500/20"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Calls
            </button>
            <button
              onClick={() => setTab("puts")}
              className={cn(
                "px-8 py-2 text-xs font-semibold normal-case tracking-normal rounded-xl transition-all",
                tab === "puts"
                  ? "bg-destructive text-white shadow-none shadow-destructive/20"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Puts
            </button>
          </div>

          <div className="h-8 w-px bg-border hidden sm:block mx-2" />

          {expiryDates.length > 0 && (
            <div className="relative group">
              <select
                value={selectedExpiry ?? expiryDates[0] ?? ""}
                onChange={(e) => setSelectedExpiry(e.target.value || null)}
                className="appearance-none bg-secondary/80 border border-border text-sm font-semibold px-6 pr-12 py-2.5 rounded-xl text-foreground focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer hover:border-primary/30"
              >
                {expiryDates.map((d) => (
                  <option key={d} value={d} className="bg-background">
                    {d}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none group-hover:text-primary transition-colors"
              />
            </div>
          )}

          <div className="ml-auto flex items-center gap-6">
            <div className="text-right hidden md:block">
              <p className="text-[11px] text-muted-foreground font-semibold normal-case tracking-normal leading-none mb-1.5 opacity-60">
                Underlying Spot
              </p>
              <p className="text-lg font-mono font-semibold text-foreground tracking-normal tabular-nums">
                ₹
                {underlyingPrice > 0
                  ? underlyingPrice.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })
                  : "—"}
              </p>
            </div>
            <div
              className={cn(
                "px-4 py-2 rounded-xl border text-xs font-semibold normal-case tracking-[0.1em] flex items-center gap-2.5 shadow-sm",
                marketClosed
                  ? "border-amber-500/20 text-amber-500 bg-amber-500/10"
                  : "border-emerald-500/20 text-emerald-500 bg-emerald-500/10",
              )}
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  marketClosed
                    ? "bg-amber-500/50"
                    : "bg-emerald-500 animate-ping",
                )}
              />
              {marketClosed ? "Halted" : "Practice model"}
            </div>
          </div>
        </div>

        {/* Table Content - Horizontal scrolling preserved, vertical scrolling handled by parent */}
        <div className="w-full overflow-x-auto custom-scrollbar">
          {loading ? (
            <div className="flex flex-col min-h-[400px] animate-pulse p-6 gap-3 overflow-hidden">
              {/* Header Stencil */}
              <div className="flex justify-between items-center mb-4 border-b border-border pb-4 gap-4 px-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-4 bg-muted/30 rounded-full w-full max-w-[60px]"
                  />
                ))}
              </div>
              {/* Rows Stencil */}
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center mb-3 px-2"
                >
                  <div className="h-5 bg-muted/20 rounded-md w-16" />
                  <div className="h-5 bg-muted/20 rounded-md w-12" />
                  <div className="h-5 bg-emerald-500/10 rounded-md w-14" />
                  <div className="h-5 bg-red-500/10 rounded-md w-14" />
                  <div className="flex-1" />
                  <div className="h-5 bg-muted/20 rounded-md w-10 ml-4" />
                  <div className="h-5 bg-muted/20 rounded-md w-10 ml-4" />
                </div>
              ))}
            </div>
          ) : !hasData ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 py-16 text-center px-12">
              <div className="p-6 rounded-full bg-secondary shadow-inner opacity-80">
                <Monitor size={48} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-foreground text-sm font-semibold normal-case tracking-normal mb-2">
                  No option quotes
                </p>
                <p className="text-muted-foreground text-xs font-bold leading-relaxed max-w-[280px]">
                  {marketClosed
                    ? "Practice quotes could not be loaded. Try again shortly."
                    : "No options metadata received for this underlying instrument."}
                </p>
              </div>
            </div>
          ) : (
            <table className="w-full text-left min-w-[700px] border-separate border-spacing-0">
              <thead className="sticky top-0 bg-background/80  z-20">
                <tr className="text-[11px] font-semibold tracking-[0.15em] text-muted-foreground normal-case border-b border-border">
                  <th className="px-4 py-3 border-b border-border font-semibold">
                    Strike Price
                  </th>
                  <th className="px-4 py-3 border-b border-border font-semibold">
                    LTP
                  </th>
                  <th className="px-4 py-3 border-b border-border font-semibold">
                    Bid
                  </th>
                  <th className="px-4 py-3 border-b border-border font-semibold">
                    Ask
                  </th>
                  <th className="px-4 py-3 border-b border-border font-semibold">
                    Change
                  </th>
                  <th className="px-4 py-3 border-b border-border font-semibold">
                    Volume
                  </th>
                  <th className="px-4 py-3 border-b border-border font-semibold">
                    O.I.
                  </th>
                  <th className="px-4 py-3 border-b border-border font-semibold text-right">
                    Imp. Volatility
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((c, idx) => (
                  <ContractRow
                    key={`${tab}-${c.contractSymbol}`}
                    c={c}
                    type={tab}
                    underlyingPrice={underlyingPrice}
                    onSelect={(c, t) => setSelected({ contract: c, type: t })}
                    disabled={marketClosed}
                    idx={idx}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {marketClosed && hasData && (
          <div className="px-6 py-4 border-t border-border flex-shrink-0 bg-background/40">
            <p className="text-[11px] text-muted-foreground font-semibold text-center normal-case tracking-[0.25em] opacity-60">
              Practice estimates · Not exchange option quotes
            </p>
          </div>
        )}
      </div>
    </>
  );
}
