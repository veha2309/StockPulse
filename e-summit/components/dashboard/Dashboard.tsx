"use client";
import { useState, useEffect, useCallback } from "react";
import Orbs from "@/components/ui/Orbs";
import ChartArea from "./ChartArea";
import TradePanel from "./TradePanel";
import PortfolioPanel from "./PortfolioPanel";
import ProfileDropdown from "./ProfileDropdown";
import EditProfileModal from "./EditProfileModal";
import OptionsChain from "./OptionsChain";
import { COMPANIES } from "@/lib/constants";
import type { UserData, ChartPoint, CandlePoint, Quote, Company } from "@/lib/types";

type MainTab   = "chart" | "options";
type MobileTab = "markets" | "chart" | "options" | "portfolio";

function Drawer({ open, onClose, children, side = "left" }: {
  open: boolean; onClose: () => void; children: React.ReactNode; side?: "left" | "right";
}) {
  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={onClose} />}
      <div className={`fixed top-0 ${side === "left" ? "left-0" : "right-0"} h-full w-72 bg-[#0a0a0f] border-${side === "left" ? "r" : "l"} border-white/[0.06] z-50 flex flex-col transition-transform duration-300 lg:hidden ${open ? "translate-x-0" : side === "left" ? "-translate-x-full" : "translate-x-full"}`}>
        {children}
      </div>
    </>
  );
}

function CompanyList({ selected, onSelect }: { selected: Company; onSelect: (c: Company) => void }) {
  return (
    <nav className="flex-1 overflow-y-auto py-3 px-2">
      <p className="text-[10px] font-semibold tracking-widest text-gray-600 uppercase px-3 mb-2">Markets</p>
      {COMPANIES.map(c => (
        <button key={c.symbol} onClick={() => onSelect(c)}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl mb-0.5 text-left transition-all ${
            selected.symbol === c.symbol ? "bg-white/[0.08] text-white" : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]"
          }`}>
          <div>
            <p className={`text-sm font-medium leading-none ${selected.symbol === c.symbol ? "text-white" : ""}`}>{c.name}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">{c.sector}</p>
          </div>
          <span className={`text-[10px] font-mono font-bold ${selected.symbol === c.symbol ? "text-blue-400" : "text-gray-700"}`}>{c.symbol}</span>
        </button>
      ))}
    </nav>
  );
}

export default function Dashboard({ user: initialUser, onLogout }: { user: UserData; onLogout: () => void }) {
  const [user, setUser]             = useState(initialUser);
  const [editing, setEditing]       = useState(false);
  const [selected, setSelected]     = useState(COMPANIES[0]);
  const [chartData, setChartData]   = useState<ChartPoint[]>([]);
  const [candleData, setCandleData] = useState<CandlePoint[]>([]);
  const [chartType, setChartType]   = useState<"area" | "candle">("area");
  const [quote, setQuote]           = useState<Quote | null>(null);
  const [loading, setLoading]       = useState(true);
  const [wsReady, setWsReady]       = useState(false);
  const [mainTab, setMainTab]       = useState<MainTab>("chart");

  // Mobile
  const [mobileTab, setMobileTab]         = useState<MobileTab>("chart");
  const [marketsOpen, setMarketsOpen]     = useState(false);
  const [portfolioOpen, setPortfolioOpen] = useState(false);

  // Poll server for user data changes (admin edits reflect in realtime)
  useEffect(() => {
    const poll = async () => {
      const res = await fetch(`/api/auth?email=${encodeURIComponent(user.email)}`).catch(() => null);
      if (!res?.ok) return;
      const data = await res.json();
      setUser(prev => {
        if (
          prev.eTokens  !== data.eTokens ||
          JSON.stringify(prev.portfolio) !== JSON.stringify(data.portfolio) ||
          JSON.stringify(prev.options)   !== JSON.stringify(data.options)
        ) {
          return { ...prev, eTokens: data.eTokens, portfolio: data.portfolio, options: data.options ?? [] };
        }
        return prev;
      });
    };
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [user.email]);

  const fetchHistory = useCallback(async (symbol: string, silent = false) => {
    if (!silent) setLoading(true);
    const res  = await fetch(`/api/stock?symbol=${symbol}`);
    const data = await res.json();
    setQuote(data.quote);
    setChartData(data.chartData);
    setCandleData(data.candleData ?? []);
    if (!silent) { setLoading(false); setWsReady(true); }
  }, []);

  useEffect(() => {
    setWsReady(false);
    fetchHistory(selected.symbol);
    const interval = setInterval(() => fetchHistory(selected.symbol, true), 15000);
    return () => clearInterval(interval);
  }, [selected, fetchHistory]);

  function handleSelectCompany(c: Company) {
    setSelected(c);
    setMarketsOpen(false);
    setMobileTab("chart");
    setMainTab("chart");
  }

  const displayPrice = quote?.c ?? null;
  const isPositive   = quote ? quote.d >= 0 : true;
  const accent       = isPositive ? "#34d399" : "#f87171";

  const stats = quote ? [
    { label: "Open",       value: `₹${quote.o.toFixed(2)}`  },
    { label: "High",       value: `₹${quote.h.toFixed(2)}`  },
    { label: "Low",        value: `₹${quote.l.toFixed(2)}`  },
    { label: "Prev Close", value: `₹${quote.pc.toFixed(2)}` },
  ] : [];

  const activeMobileTab = mobileTab === "options" ? "options" : "chart";

  return (
    <div className="relative flex h-screen overflow-hidden bg-[#0a0a0f]">
      <Orbs />
      {editing && <EditProfileModal user={user} onUpdate={setUser} onClose={() => setEditing(false)} />}

      {/* Mobile drawers */}
      <Drawer open={marketsOpen} onClose={() => setMarketsOpen(false)} side="left">
        <div className="px-5 py-5 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">📈</span>
            <span className="font-bold gradient-text text-base">StockPulse</span>
          </div>
          <button onClick={() => setMarketsOpen(false)} className="text-gray-600 hover:text-gray-300 text-lg">✕</button>
        </div>
        <CompanyList selected={selected} onSelect={handleSelectCompany} />
        <div className="px-4 py-4 border-t border-white/[0.06] flex-shrink-0">
          <button onClick={onLogout} className="w-full text-xs text-gray-600 hover:text-gray-300 transition-colors py-2 rounded-lg hover:bg-white/[0.04] flex items-center justify-center gap-1.5">
            <span>↩</span> Sign out
          </button>
        </div>
      </Drawer>

      <Drawer open={portfolioOpen} onClose={() => setPortfolioOpen(false)} side="right">
        <PortfolioPanel user={user} onClose={() => setPortfolioOpen(false)} />
      </Drawer>

      {/* Desktop left sidebar */}
      <aside className="hidden lg:flex relative z-10 w-56 flex-shrink-0 flex-col border-r border-white/[0.06] bg-black/30 backdrop-blur-xl">
        <div className="px-5 py-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className="text-lg">📈</span>
            <span className="font-bold gradient-text text-base tracking-tight">StockPulse</span>
          </div>
          <p className="text-[11px] text-gray-600 mt-0.5 truncate">Hey, {user.name}</p>
        </div>
        <CompanyList selected={selected} onSelect={setSelected} />
        <div className="px-4 py-4 border-t border-white/[0.06]">
          <button onClick={onLogout} className="w-full text-xs text-gray-600 hover:text-gray-300 transition-colors py-2 rounded-lg hover:bg-white/[0.04] flex items-center justify-center gap-1.5">
            <span>↩</span> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="relative z-10 flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top bar */}
        <header className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-white/[0.06] bg-black/20 backdrop-blur-xl flex-shrink-0 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => setMarketsOpen(true)} className="lg:hidden text-gray-400 hover:text-white p-1 flex-shrink-0">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
              </svg>
            </button>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-lg font-bold text-white leading-none truncate">{selected.name}</h1>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 truncate">{selected.sector} · {selected.symbol}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            <div className={`flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-[11px] px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border ${
              wsReady ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" : "border-yellow-500/30 text-yellow-400 bg-yellow-500/10"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${wsReady ? "bg-emerald-400 animate-pulse" : "bg-yellow-400"}`} />
              <span className="hidden sm:inline">{wsReady ? "Live" : "Loading"}</span>
            </div>
            <div className="text-[10px] sm:text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/30 font-semibold glass px-2 sm:px-3 py-1 sm:py-1.5 rounded-full">
              ₹{(user.eTokens ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <button onClick={() => setPortfolioOpen(true)} className="lg:hidden glass px-2 py-1.5 rounded-full text-[10px] text-gray-300 hover:text-white border border-white/[0.07]">
              💼
            </button>
            <ProfileDropdown user={user} onLogout={onLogout} onEditOpen={() => setEditing(true)} />
          </div>
        </header>

        {/* Price bar */}
        <div className="flex items-center gap-3 sm:gap-6 px-3 sm:px-6 py-3 sm:py-4 border-b border-white/[0.06] flex-shrink-0 overflow-x-auto">
          <div className="flex items-baseline gap-2 sm:gap-3 flex-shrink-0">
            <span className="text-2xl sm:text-4xl font-bold text-white tabular-nums">
              {displayPrice ? `₹${displayPrice.toFixed(2)}` : "—"}
            </span>
            {quote && (
              <span className={`text-sm sm:text-base font-semibold flex-shrink-0 ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                {isPositive ? "▲" : "▼"} {Math.abs(quote.d).toFixed(2)} ({Math.abs(quote.dp).toFixed(2)}%)
              </span>
            )}
          </div>
          <div className="h-8 w-px bg-white/[0.06] flex-shrink-0 hidden sm:block" />
          {stats.map(s => (
            <div key={s.label} className="flex-shrink-0 hidden sm:block">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider">{s.label}</p>
              <p className="text-sm font-semibold text-gray-300 tabular-nums">{s.value}</p>
            </div>
          ))}
          <div className="flex gap-3 sm:hidden">
            {stats.slice(0, 2).map(s => (
              <div key={s.label} className="flex-shrink-0">
                <p className="text-[9px] text-gray-600 uppercase">{s.label}</p>
                <p className="text-xs font-semibold text-gray-300 tabular-nums">{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Main tab bar — desktop */}
        <div className="hidden sm:flex border-b border-white/[0.06] px-6 bg-black/10 flex-shrink-0">
          {([
            { id: "chart",   label: "Chart & Trade" },
            { id: "options", label: "Options Chain" },
          ] as { id: MainTab; label: string }[]).map(t => (
            <button key={t.id} onClick={() => setMainTab(t.id)}
              className={`px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${
                mainTab === t.id ? "border-blue-500 text-white" : "border-transparent text-gray-500 hover:text-gray-300"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Desktop: show based on mainTab */}
          <div className={`flex-1 flex-col overflow-hidden ${mainTab === "chart" ? "flex" : "hidden"} sm:flex ${mainTab !== "chart" ? "sm:hidden" : ""}`}>
            <ChartArea
              chartType={chartType} setChartType={setChartType}
              chartData={chartData} candleData={candleData}
              loading={loading} accent={accent} isPositive={isPositive}
            />
            <TradePanel user={user} company={selected} price={displayPrice} onTradeSuccess={setUser} />
          </div>

          <div className={`flex-1 overflow-hidden ${mainTab === "options" ? "flex flex-col" : "hidden"} sm:flex sm:flex-col ${mainTab !== "options" ? "sm:hidden" : ""}`}>
            <OptionsChain
              symbol={selected.symbol} company={selected}
              user={user} underlyingPrice={displayPrice ?? 0}
              onTradeSuccess={setUser}
            />
          </div>
        </div>

        {/* Mobile bottom nav */}
        <nav className="sm:hidden flex border-t border-white/[0.06] bg-black/40 backdrop-blur-xl flex-shrink-0">
          {([
            { id: "markets",   label: "Markets",   icon: "📊" },
            { id: "chart",     label: "Chart",     icon: "📈" },
            { id: "options",   label: "Options",   icon: "⚡" },
            { id: "portfolio", label: "Portfolio", icon: "💼" },
          ] as { id: MobileTab; label: string; icon: string }[]).map(tab => (
            <button key={tab.id}
              onClick={() => {
                if (tab.id === "markets")   { setMarketsOpen(true);   return; }
                if (tab.id === "portfolio") { setPortfolioOpen(true); return; }
                setMobileTab(tab.id);
                setMainTab(tab.id as MainTab);
              }}
              className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 text-[10px] font-medium transition-colors ${
                activeMobileTab === tab.id ? "text-blue-400" : "text-gray-600 hover:text-gray-400"
              }`}>
              <span className="text-base">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </main>

      {/* Desktop right sidebar */}
      <aside className="hidden lg:flex relative z-10 w-64 flex-shrink-0 flex-col border-l border-white/[0.06] bg-black/30 backdrop-blur-xl">
        <PortfolioPanel user={user} />
      </aside>
    </div>
  );
}
