"use client";
import { useState, useEffect } from "react";
import Toast from "@/components/ui/Toast";
import type { OptionContract, UserData, ToastData, Company } from "@/lib/types";

type Tab = "calls" | "puts";

function fmt(n: number) { return n > 0 ? n.toFixed(2) : "—"; }

function ContractRow({ c, type, underlyingPrice, onSelect, disabled }: {
  c: OptionContract; type: Tab; underlyingPrice: number;
  onSelect: (c: OptionContract, t: Tab) => void; disabled: boolean;
}) {
  const itm = type === "calls" ? c.strike < underlyingPrice : c.strike > underlyingPrice;
  return (
    <tr
      onClick={() => !disabled && onSelect(c, type)}
      className={`border-b border-white/[0.04] text-xs transition-colors ${
        disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-white/[0.04]"
      } ${itm ? "bg-white/[0.02]" : ""}`}
    >
      <td className={`px-3 py-2 font-mono font-semibold ${itm ? (type === "calls" ? "text-emerald-400" : "text-red-400") : "text-gray-300"}`}>
        ₹{c.strike.toLocaleString()}
      </td>
      <td className="px-3 py-2 font-mono text-gray-300">{fmt(c.lastPrice)}</td>
      <td className="px-3 py-2 font-mono text-gray-500">{fmt(c.bid)}</td>
      <td className="px-3 py-2 font-mono text-gray-500">{fmt(c.ask)}</td>
      <td className={`px-3 py-2 font-mono ${c.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
        {c.change >= 0 ? "+" : ""}{fmt(c.change)}
      </td>
      <td className="px-3 py-2 font-mono text-gray-500">{c.volume > 0 ? c.volume.toLocaleString() : "—"}</td>
      <td className="px-3 py-2 font-mono text-gray-500">{c.openInterest > 0 ? c.openInterest.toLocaleString() : "—"}</td>
      <td className="px-3 py-2 font-mono text-gray-600">{c.impliedVolatility > 0 ? (c.impliedVolatility * 100).toFixed(1) + "%" : "—"}</td>
    </tr>
  );
}

function BuyModal({ contract, optionType, underlyingSymbol, user, onClose, onSuccess }: {
  contract: OptionContract; optionType: Tab; underlyingSymbol: string;
  user: UserData; onClose: () => void; onSuccess: (u: UserData) => void;
}) {
  const [lots, setLots]       = useState("1");
  const [action, setAction]   = useState<"buy" | "sell">("buy");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const premium     = contract.lastPrice || ((contract.bid + contract.ask) / 2) || 0;
  const total       = parseFloat(lots || "0") * premium;
  const existingPos = (user.options ?? []).find(o => o.contractSymbol === contract.contractSymbol && o.side === "buy");
  const canSell     = existingPos && existingPos.lots >= +lots;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lots || +lots <= 0) { setError("Enter valid lots"); return; }
    setLoading(true); setError("");
    const res  = await fetch("/api/trade", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tradeType: "option", email: user.email, action,
        contractSymbol: contract.contractSymbol,
        underlyingSymbol, optionType: optionType === "calls" ? "call" : "put",
        strike: contract.strike, expiration: contract.expiration,
        lots: +lots, premium,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error); return; }
    onSuccess(data.user);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] animate-fadeIn px-4" onClick={onClose}>
      <div className="glass rounded-2xl p-6 w-full max-w-sm animate-fadeInUp" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white font-bold text-sm">{optionType === "calls" ? "CALL" : "PUT"} · ₹{contract.strike.toLocaleString()}</p>
            <p className="text-gray-500 text-xs mt-0.5">
              Exp: {new Date(contract.expiration * 1000).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300 text-lg">✕</button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
          {[["LTP", fmt(contract.lastPrice)], ["Bid", fmt(contract.bid)], ["Ask", fmt(contract.ask)]].map(([l, v]) => (
            <div key={l} className="bg-white/[0.04] rounded-xl py-2">
              <p className="text-[10px] text-gray-600 uppercase">{l}</p>
              <p className="text-sm font-mono text-gray-300">₹{v}</p>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex bg-black/30 p-1 rounded-xl border border-white/[0.06]">
            <button type="button" onClick={() => setAction("buy")}
              className={`flex-1 text-xs font-semibold rounded-lg py-2 transition-colors ${action === "buy" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}>Buy</button>
            <button type="button" onClick={() => setAction("sell")} disabled={!existingPos}
              className={`flex-1 text-xs font-semibold rounded-lg py-2 transition-colors ${action === "sell" ? "bg-red-600 text-white" : "text-gray-400 hover:text-white"} disabled:opacity-30`}>
              Sell / Close
            </button>
          </div>

          <div>
            <label className="text-[10px] font-semibold tracking-widest text-gray-500 uppercase">Lots</label>
            <input type="number" value={lots} onChange={e => setLots(e.target.value)} min="1" placeholder="1"
              className="input-field w-full px-4 py-3 rounded-xl text-white text-sm placeholder-gray-700 mt-1.5" />
          </div>

          <div className="flex justify-between text-xs text-gray-500 px-1">
            <span>Premium / lot</span><span className="font-mono text-gray-300">₹{fmt(premium)}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-500 px-1">
            <span>Total cost</span><span className="font-mono text-gray-300">₹{total.toFixed(2)}</span>
          </div>
          {existingPos && (
            <div className="flex justify-between text-xs text-gray-500 px-1">
              <span>You hold</span>
              <span className="font-mono text-emerald-400">{existingPos.lots} lot{existingPos.lots > 1 ? "s" : ""}</span>
            </div>
          )}

          {error && <p className="text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

          <button type="submit" disabled={loading || (action === "sell" && !canSell)}
            className="btn-primary py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed mt-1">
            {loading ? "Processing..." : `${action === "buy" ? "Buy" : "Sell"} ${lots} Lot${+lots > 1 ? "s" : ""}`}
          </button>
        </form>
      </div>
    </div>
  );
}

type Props = {
  symbol: string; company: Company; user: UserData; underlyingPrice: number;
  onTradeSuccess: (u: UserData) => void;
};

export default function OptionsChain({ symbol, company, user, underlyingPrice, onTradeSuccess }: Props) {
  const [tab, setTab]                       = useState<Tab>("calls");
  const [calls, setCalls]                   = useState<OptionContract[]>([]);
  const [puts, setPuts]                     = useState<OptionContract[]>([]);
  const [expiryDates, setExpiryDates]       = useState<string[]>([]);
  const [selectedExpiry, setSelectedExpiry] = useState<string | null>(null);
  const [loading, setLoading]               = useState(true);
  const [marketClosed, setMarketClosed]     = useState(false);
  const [selected, setSelected]             = useState<{ contract: OptionContract; type: Tab } | null>(null);
  const [toast, setToast]                   = useState<ToastData | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    const fetchOptions = async (silent = false) => {
        if (!silent) setLoading(true);
        const url = selectedExpiry
          ? `/api/options?symbol=${symbol}&expiry=${encodeURIComponent(selectedExpiry)}`
          : `/api/options?symbol=${symbol}`;
        
        try {
            const r = await fetch(url);
            const data = await r.json();
            if (!isMounted) return;
            
            setCalls(data.calls ?? []);
            setPuts(data.puts   ?? []);
            setMarketClosed(data.marketClosed ?? false);
            if (data.expiryDates?.length && !selectedExpiry) {
              setExpiryDates(data.expiryDates);
              setSelectedExpiry(data.expiryDates[0]);
            }
        } catch {
            if (isMounted) setMarketClosed(true);
        } finally {
            if (isMounted && !silent) setLoading(false);
        }
    };

    fetchOptions();
    const interval = setInterval(() => fetchOptions(true), 10000);

    return () => {
        isMounted = false;
        clearInterval(interval);
    };
  }, [symbol, selectedExpiry]);

  // reset expiry when symbol changes
  useEffect(() => {
    setSelectedExpiry(null);
    setExpiryDates([]);
    setCalls([]);
    setPuts([]);
  }, [symbol]);

  const rows    = tab === "calls" ? calls : puts;
  const hasData = rows.length > 0;

  return (
    <>
      {toast && <Toast key={toast.message} toast={toast} onDone={() => setToast(null)} />}

      {selected && !marketClosed && (
        <BuyModal
          contract={selected.contract} optionType={selected.type}
          underlyingSymbol={symbol} user={user}
          onClose={() => setSelected(null)}
          onSuccess={u => {
            onTradeSuccess(u);
            setSelected(null);
            setToast({ message: "Option order placed!", type: "success" });
          }}
        />
      )}

      <div className="flex flex-col h-full overflow-hidden">

        {/* Market closed banner */}
        {marketClosed && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 flex-shrink-0">
            <span className="text-amber-400 text-sm">🌙</span>
            <p className="text-amber-400 text-xs font-medium">
              Market closed · Showing last available data · Trading disabled
            </p>
            <p className="text-amber-600 text-xs ml-auto hidden sm:block">9:15 AM – 3:30 PM IST</p>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-2 px-3 sm:px-4 py-3 border-b border-white/[0.06] flex-shrink-0 flex-wrap gap-y-2">
          <div className="flex bg-black/30 p-1 rounded-xl border border-white/[0.06]">
            <button onClick={() => setTab("calls")} className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${tab === "calls" ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white"}`}>Calls</button>
            <button onClick={() => setTab("puts")}  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${tab === "puts"  ? "bg-red-600 text-white"     : "text-gray-400 hover:text-white"}`}>Puts</button>
          </div>

          {expiryDates.length > 0 && (
            <select
              value={selectedExpiry ?? ""}
              onChange={e => setSelectedExpiry(e.target.value || null)}
              className="input-field text-xs px-3 py-1.5 rounded-xl text-gray-300 bg-black/30"
            >
              {expiryDates.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}

          <div className="ml-auto flex items-center gap-3">
            {marketClosed && (
              <span className="text-[10px] text-amber-500 font-medium hidden sm:inline">● Market Closed</span>
            )}
            <span className="text-[10px] text-gray-600">
              Spot: <span className="text-gray-400 font-mono">₹{underlyingPrice > 0 ? underlyingPrice.toFixed(2) : "—"}</span>
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-600 text-sm">Loading options chain...</p>
              <p className="text-gray-700 text-xs">Fetching from NSE — may take a few seconds</p>
            </div>
          ) : !hasData ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 py-16">
              <span className="text-4xl">📭</span>
              <p className="text-gray-500 text-sm mt-2">No options data available</p>
              <p className="text-gray-700 text-xs text-center px-8">
                {marketClosed
                  ? "No cached data yet. Check back during market hours (9:15 AM – 3:30 PM IST)."
                  : "NSE may not have options data for this symbol right now."}
              </p>
            </div>
          ) : (
            <table className="w-full text-left min-w-[600px]">
              <thead className="sticky top-0 bg-[#0a0a0f] border-b border-white/[0.06]">
                <tr className="text-[10px] font-semibold tracking-widest text-gray-600 uppercase">
                  <th className="px-3 py-2">Strike</th>
                  <th className="px-3 py-2">LTP</th>
                  <th className="px-3 py-2">Bid</th>
                  <th className="px-3 py-2">Ask</th>
                  <th className="px-3 py-2">Chg</th>
                  <th className="px-3 py-2">Volume</th>
                  <th className="px-3 py-2">OI</th>
                  <th className="px-3 py-2">IV</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(c => (
                  <ContractRow
                    key={c.contractSymbol} c={c} type={tab}
                    underlyingPrice={underlyingPrice}
                    onSelect={(c, t) => setSelected({ contract: c, type: t })}
                    disabled={marketClosed}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer hint when closed but has data */}
        {marketClosed && hasData && (
          <div className="px-4 py-2 border-t border-white/[0.06] flex-shrink-0">
            <p className="text-[10px] text-gray-700 text-center">
              Data from last trading session · Click rows to view details · Trading resumes at market open
            </p>
          </div>
        )}
      </div>
    </>
  );
}
