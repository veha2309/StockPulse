"use client";
import { useState, useEffect } from "react";
import { COMPANIES } from "@/lib/constants";
import type { UserData, TradeRecord, OptionTradeRecord } from "@/lib/types";

type PanelTab = "holdings" | "history";

function fmt(n: number) { return `₹${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + " " +
         d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export default function PortfolioPanel({ 
    user, 
    onClose,
    onSelectCompany,
    onFocusSell,
    onUserUpdate
}: { 
    user: UserData; 
    onClose?: () => void;
    onSelectCompany?: (symbol: string) => void;
    onFocusSell?: () => void;
    onUserUpdate?: (user: UserData) => void;
}) {
  const [tab, setTab]                       = useState<PanelTab>("holdings");
  const [trades, setTrades]                 = useState<TradeRecord[]>([]);
  const [optionTrades, setOptionTrades]     = useState<OptionTradeRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [livePrices, setLivePrices]         = useState<Record<string, number>>({});

  const [targetingSymbol, setTargetingSymbol] = useState<string | null>(null);
  const [targetSl, setTargetSl] = useState("");
  const [targetTp, setTargetTp] = useState("");
  const [updatingTarget, setUpdatingTarget] = useState(false);

  // Poll for option chain updates inside Portfolio isn't required here, but we fetch live quotes for equity
  useEffect(() => {
    if (tab !== "holdings" || !user.portfolio || user.portfolio.length === 0) return;
    
    // Poll Yahoo Finance for live prices
    const fetchPrices = async () => {
        const symbols = user.portfolio!.map(p => p.symbol).join(",");
        try {
            const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbols)}`);
            if (res.ok) {
                const data = await res.json();
                setLivePrices(data);

                // Auto-Execution Check for SL/TP boundaries
                for (const item of user.portfolio!) {
                    const price = data[item.symbol];
                    if (!price) continue;

                    let shouldSell = false;
                    let triggerType = "";

                    if (item.sl && price <= item.sl) { shouldSell = true; triggerType = "Stop Loss"; }
                    if (item.tp && price >= item.tp) { shouldSell = true; triggerType = "Take Profit"; }

                    if (shouldSell) {
                        console.log(`[Auto-Sell] Triggered ${triggerType} for ${item.symbol} at ₹${price}`);
                        fetch('/api/trade', {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                email: user.email,
                                action: "sell",
                                symbol: item.symbol,
                                amount: item.amount,
                                price: price,
                                type: "equity"
                            })
                        }).then(r => r.json()).then(resData => {
                            if (resData.user && onUserUpdate) onUserUpdate(resData.user);
                        }).catch(console.error);
                    }
                }
            }
        } catch (err) {
            console.error("Failed to fetch live prices", err);
        }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 10000);
    return () => clearInterval(interval);
  }, [user.portfolio, tab, user.email, onUserUpdate]);

  useEffect(() => {
    if (tab !== "history") return;
    setHistoryLoading(true);
    fetch(`/api/history?email=${encodeURIComponent(user.email)}`)
      .then(r => r.json())
      .then(data => {
        setTrades(data.trades ?? []);
        setOptionTrades(data.optionTrades ?? []);
        setHistoryLoading(false);
      })
      .catch(() => setHistoryLoading(false));
  }, [tab, user.email]);

  const options = user.options ?? [];

  // Calculate Portfolio Valuations
  let totalInvested = 0;
  let totalCurrentValue = 0;

  (user.portfolio ?? []).forEach(item => {
      const invested = item.amount * item.avgBuyPrice;
      totalInvested += invested;
      // Use live price if available, else fallback to avgBuyPrice so value doesn't drop to 0
      const currentPrice = livePrices[item.symbol] || item.avgBuyPrice; 
      totalCurrentValue += item.amount * currentPrice;
  });

  const totalPnL = totalCurrentValue - totalInvested;
  const isPnLPositive = totalPnL >= 0;

  function handleActionClick(symbol: string, action: "view" | "sell" | "targets") {
      if (action === "targets") {
          const item = user.portfolio?.find(p => p.symbol === symbol);
          setTargetingSymbol(symbol);
          setTargetSl(item?.sl ? item.sl.toString() : "");
          setTargetTp(item?.tp ? item.tp.toString() : "");
          return;
      }
      if (onSelectCompany) onSelectCompany(symbol);
      if (action === "sell" && onFocusSell) {
          setTimeout(() => onFocusSell(), 100);
      }
      if (onClose) onClose();
  }

  async function saveTargets(symbol: string) {
      setUpdatingTarget(true);
      try {
          const res = await fetch('/api/targets', {
              method: 'POST',
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                  email: user.email,
                  symbol,
                  sl: targetSl ? parseFloat(targetSl) : null,
                  tp: targetTp ? parseFloat(targetTp) : null
              })
          });
          const data = await res.json();
          if (data.user && onUserUpdate) onUserUpdate(data.user);
          setTargetingSymbol(null);
      } catch (err) {
          console.error(err);
      }
      setUpdatingTarget(false);
  }

  return (
    <aside className="relative z-10 w-full h-full flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-base font-bold text-white">Portfolio</h2>
          <p className="text-xs text-gray-500 mt-0.5">Paper trading</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300 text-lg transition-colors">✕</button>
        )}
      </div>

      {/* Balance & PnL Header */}
      <div className="px-5 py-3 border-b border-white/[0.06] flex-shrink-0 bg-black/20">
        <div className="flex justify-between items-end mb-3">
            <div>
                <p className="text-[10px] font-semibold tracking-widest text-gray-600 uppercase">Balance</p>
                <p className="text-xl font-bold text-white mt-0.5">{fmt(user.eTokens ?? 0)}</p>
            </div>
            <div className="text-right">
                <p className="text-[10px] font-semibold tracking-widest text-gray-600 uppercase">Holdings Value</p>
                <p className="text-xl font-bold text-white mt-0.5 tabular-nums">{fmt(totalCurrentValue)}</p>
            </div>
        </div>
        
        <div className="flex justify-between items-center bg-white/[0.03] p-2 rounded-lg border border-white/[0.05]">
            <div>
                <p className="text-[9px] text-gray-500 uppercase tracking-wider">Invested</p>
                <p className="text-xs text-gray-300 font-mono mt-0.5">{fmt(totalInvested)}</p>
            </div>
            <div className="text-right">
                <p className="text-[9px] text-gray-500 uppercase tracking-wider">Overall P&L</p>
                <p className={`text-xs font-mono font-semibold mt-0.5 ${totalPnL === 0 ? "text-gray-400" : isPnLPositive ? "text-emerald-400" : "text-red-400"}`}>
                    {totalPnL > 0 ? "+" : ""}{fmt(totalPnL)}
                </p>
            </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-white/[0.06] flex-shrink-0">
        <button onClick={() => setTab("holdings")}
          className={`flex-1 py-2.5 text-xs font-semibold transition-colors border-b-2 ${tab === "holdings" ? "border-blue-500 text-white" : "border-transparent text-gray-600 hover:text-gray-400"}`}>
          Holdings
        </button>
        <button onClick={() => setTab("history")}
          className={`flex-1 py-2.5 text-xs font-semibold transition-colors border-b-2 ${tab === "history" ? "border-blue-500 text-white" : "border-transparent text-gray-600 hover:text-gray-400"}`}>
          History
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Holdings ── */}
        {tab === "holdings" && (
          <div className="py-2 px-2">
            <p className="text-[10px] font-semibold tracking-widest text-gray-600 uppercase px-3 mt-2 mb-1">
              Stocks ({(user.portfolio ?? []).length})
            </p>
            {(user.portfolio ?? []).length > 0 ? (
              (user.portfolio ?? []).map(item => {
                const currentPrice = livePrices[item.symbol] || item.avgBuyPrice;
                const pnl = (currentPrice - item.avgBuyPrice) * item.amount;
                const isItemPositive = pnl >= 0;
                
                return (
                <div key={item.symbol} className="group px-3 py-2.5 rounded-xl mb-0.5 hover:bg-white/[0.04] transition-all relative overflow-hidden">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-white">{COMPANIES.find(c => c.symbol === item.symbol)?.name ?? item.symbol}</p>
                      <p className="text-[10px] text-gray-600 font-mono mt-0.5">{item.amount} shares @ {fmt(item.avgBuyPrice)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono text-gray-300">{fmt(item.amount * currentPrice)}</p>
                      <p className={`text-[10px] font-mono mt-0.5 ${pnl === 0 ? "text-gray-500" : isItemPositive ? "text-emerald-400" : "text-red-400"}`}>
                        {pnl > 0 ? "+" : ""}{fmt(pnl)}
                      </p>
                    </div>
                  </div>
                  
                  {/* Sub-row displaying active targets if present */}
                  {(item.sl || item.tp) && (
                      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/[0.04] text-[9px] font-mono text-gray-500">
                          {item.tp && <span className="text-blue-400">TP: {fmt(item.tp)}</span>}
                          {item.sl && <span className="text-amber-500">SL: {fmt(item.sl)}</span>}
                      </div>
                  )}

                  {/* Hover Actions overlay */}
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-l from-[#111116] via-[#111116] to-transparent pl-8">
                     <button onClick={() => handleActionClick(item.symbol, "targets")} className="px-2 py-1.5 text-[10px] font-semibold text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors border border-amber-500/20" title="Set Stop Loss & Take Profit">
                         🎯
                     </button>
                     <button onClick={() => handleActionClick(item.symbol, "view")} className="px-2.5 py-1.5 text-[10px] font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors border border-blue-500/20">
                         View
                     </button>
                     <button onClick={() => handleActionClick(item.symbol, "sell")} className="px-2.5 py-1.5 text-[10px] font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors border border-red-500/20">
                         Sell
                     </button>
                  </div>
                </div>
              )})
            ) : (
              <p className="text-gray-700 text-xs px-3 py-2">No stock positions.</p>
            )}

            <p className="text-[10px] font-semibold tracking-widest text-gray-600 uppercase px-3 mt-4 mb-1">
              Options ({options.length})
            </p>
            {options.length > 0 ? (
              options.map(pos => (
                <div key={pos.id} className="px-3 py-2.5 rounded-xl mb-0.5 bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex justify-between items-center">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${pos.type === "call" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                      {pos.type.toUpperCase()}
                    </span>
                    <p className="text-xs font-mono text-gray-300">{pos.lots} lot{pos.lots > 1 ? "s" : ""}</p>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-xs text-white font-medium">₹{pos.strike.toLocaleString()} strike</p>
                    <p className="text-[10px] text-gray-500 font-mono">@ {fmt(pos.premium)}</p>
                  </div>
                  <p className="text-[10px] text-gray-600 mt-0.5">
                    Exp: {new Date(pos.expiration * 1000).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    {" · "}{pos.underlyingSymbol}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-gray-700 text-xs px-3 py-2">No option positions.</p>
            )}
          </div>
        )}

        {/* ── History ── */}
        {tab === "history" && (
          <div className="py-2">
            {historyLoading ? (
              <div className="flex items-center justify-center py-12 gap-2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-600 text-xs">Loading history...</p>
              </div>
            ) : (
              <>
                {/* Equity trades */}
                {trades.length > 0 && (
                  <>
                    <p className="text-[10px] font-semibold tracking-widest text-gray-600 uppercase px-5 mt-2 mb-1">Equity Trades</p>
                    {trades.map(t => (
                      <div key={t._id} className="px-5 py-2.5 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${t.action === "buy" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                              {t.action.toUpperCase()}
                            </span>
                            <p className="text-xs font-medium text-white">{COMPANIES.find(c => c.symbol === t.symbol)?.name ?? t.symbol}</p>
                          </div>
                          <p className="text-xs font-mono text-gray-300">{fmt(t.total)}</p>
                        </div>
                        <div className="flex justify-between items-center mt-0.5">
                          <p className="text-[10px] text-gray-600">{t.amount} shares @ {fmt(t.price)}</p>
                          <p className="text-[10px] text-gray-600">{fmtDate(t.timestamp)}</p>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* Option trades */}
                {optionTrades.length > 0 && (
                  <>
                    <p className="text-[10px] font-semibold tracking-widest text-gray-600 uppercase px-5 mt-3 mb-1">Option Trades</p>
                    {optionTrades.map(t => (
                      <div key={t._id} className="px-5 py-2.5 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${t.action === "buy" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                              {t.action.toUpperCase()}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${t.optionType === "call" ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400"}`}>
                              {t.optionType.toUpperCase()}
                            </span>
                            <p className="text-xs font-medium text-white">₹{t.strike.toLocaleString()}</p>
                          </div>
                          <p className="text-xs font-mono text-gray-300">{fmt(t.total)}</p>
                        </div>
                        <div className="flex justify-between items-center mt-0.5">
                          <p className="text-[10px] text-gray-600">{t.lots} lot{t.lots > 1 ? "s" : ""} @ {fmt(t.premium)} · {t.underlyingSymbol}</p>
                          <p className="text-[10px] text-gray-600">{fmtDate(t.timestamp)}</p>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {trades.length === 0 && optionTrades.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 gap-2">
                    <span className="text-3xl">📋</span>
                    <p className="text-gray-600 text-xs mt-1">No trades yet.</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-white/[0.06] flex-shrink-0">
        <p className="text-[10px] text-gray-700 text-center">Powered by Yahoo Finance · MongoDB</p>
      </div>

      {/* Targets Modal Overlay */}
      {targetingSymbol && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#111116] border border-white/[0.1] shadow-2xl rounded-2xl w-full max-w-sm p-5 relative">
                  <button onClick={() => setTargetingSymbol(null)} className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors">✕</button>
                  <h3 className="text-white font-bold text-sm mb-1">{COMPANIES.find(c => c.symbol === targetingSymbol)?.name || targetingSymbol}</h3>
                  <p className="text-xs text-gray-500 mb-4">Set automatic bounds to protect your e-tokens.</p>

                  <div className="space-y-3 mb-5">
                      <div>
                          <label className="text-[10px] uppercase font-bold tracking-widest text-blue-400 mb-1 block">Take Profit (TP)</label>
                          <div className="relative">
                              <span className="absolute left-3 top-2.5 text-xs text-gray-500">₹</span>
                              <input type="number" value={targetTp} onChange={e => setTargetTp(e.target.value)} placeholder="0.00"
                                  className="w-full bg-white/[0.03] border border-white/[0.1] rounded-xl pl-6 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors" />
                          </div>
                          <p className="text-[9px] text-gray-600 mt-1">Sells automatically when stock hits this target.</p>
                      </div>
                      <div>
                          <label className="text-[10px] uppercase font-bold tracking-widest text-amber-500 mb-1 block">Stop Loss (SL)</label>
                          <div className="relative">
                              <span className="absolute left-3 top-2.5 text-xs text-gray-500">₹</span>
                              <input type="number" value={targetSl} onChange={e => setTargetSl(e.target.value)} placeholder="0.00"
                                  className="w-full bg-white/[0.03] border border-white/[0.1] rounded-xl pl-6 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors" />
                          </div>
                          <p className="text-[9px] text-gray-600 mt-1">Sells automatically when stock drops below.</p>
                      </div>
                  </div>

                  <button disabled={updatingTarget} onClick={() => saveTargets(targetingSymbol)}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)] hover:shadow-[0_0_25px_rgba(37,99,235,0.6)]">
                      {updatingTarget ? "Saving Bounds..." : "Confirm Bounds"}
                  </button>
              </div>
          </div>
      )}
    </aside>
  );
}
