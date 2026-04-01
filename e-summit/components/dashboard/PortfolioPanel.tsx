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

export default function PortfolioPanel({ user, onClose }: { user: UserData; onClose?: () => void }) {
  const [tab, setTab]                       = useState<PanelTab>("holdings");
  const [trades, setTrades]                 = useState<TradeRecord[]>([]);
  const [optionTrades, setOptionTrades]     = useState<OptionTradeRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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

      {/* Balance */}
      <div className="px-5 py-3 border-b border-white/[0.06] flex-shrink-0">
        <p className="text-[10px] font-semibold tracking-widest text-gray-600 uppercase">Balance</p>
        <p className="text-xl font-bold text-white mt-0.5">
          {fmt(user.eTokens ?? 0)}
        </p>
        <p className="text-xs text-gray-600">E-Tokens</p>
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
              (user.portfolio ?? []).map(item => (
                <div key={item.symbol} className="px-3 py-2.5 rounded-xl mb-0.5 hover:bg-white/[0.03] transition-colors">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium text-white">{COMPANIES.find(c => c.symbol === item.symbol)?.name ?? item.symbol}</p>
                    <p className="text-sm font-mono text-gray-300">{item.amount} shares</p>
                  </div>
                  <div className="flex justify-between items-center mt-0.5">
                    <p className="text-[10px] text-gray-600">{item.symbol}</p>
                    <p className="text-[10px] text-gray-500 font-mono">Avg {fmt(item.avgBuyPrice)}</p>
                  </div>
                </div>
              ))
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
    </aside>
  );
}
