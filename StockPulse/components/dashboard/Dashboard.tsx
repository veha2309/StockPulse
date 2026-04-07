"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Orbs from "@/components/ui/Orbs";
import ChartArea from "./ChartArea";
import TradePanel from "./TradePanel";
import PortfolioPanel from "./PortfolioPanel";
import ProfileDropdown from "./ProfileDropdown";
import EditProfileModal from "./EditProfileModal";
import OptionsChain from "./OptionsChain";
import { COMPANIES } from "@/lib/constants";
import type { UserData, ChartPoint, CandlePoint, Quote, Company } from "@/lib/types";

type MainTab = "chart" | "options";
type MobileTab = "markets" | "chart" | "options" | "portfolio";
type SidebarTab = "favorites" | "all";

/* ── helpers ── */
function favKey(email: string) { return `stockpulse_favs_${email}`; }

function loadFavs(email: string): Set<string> {
  try {
    const raw = localStorage.getItem(favKey(email));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveFavs(email: string, favs: Set<string>) {
  localStorage.setItem(favKey(email), JSON.stringify([...favs]));
}

/* ── Star icon ── */
function Star({ filled, small }: { filled: boolean; small?: boolean }) {
  const s = small ? 12 : 14;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

/* ── Drawer ── */
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

/* ── CompanyList ── */
function CompanyList({
  selected, onSelect, userEmail,
}: {
  selected: Company; onSelect: (c: Company) => void; userEmail: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Company[]>(COMPANIES);
  const [searching, setSearching] = useState(false);
  const [tab, setTab] = useState<SidebarTab>("all");
  const [favs, setFavs] = useState<Set<string>>(() => loadFavs(userEmail));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* persist favs whenever they change */
  useEffect(() => { saveFavs(userEmail, favs); }, [favs, userEmail]);

  /* search */
  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults(COMPANIES); setSearching(false); return; }
    setSearching(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.results?.length ? data.results : []);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 350);
  }, [query]);

  function toggleFav(symbol: string, e: React.MouseEvent) {
    e.stopPropagation();
    setFavs(prev => {
      const next = new Set(prev);
      next.has(symbol) ? next.delete(symbol) : next.add(symbol);
      return next;
    });
  }

  const baseList = query.trim() ? results : COMPANIES;
  const showList = tab === "favorites" ? baseList.filter(c => favs.has(c.symbol)) : baseList;
  const isFavsTab = tab === "favorites";

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* Tab bar */}
      <div className="flex border-b border-white/[0.06] px-2 pt-2 flex-shrink-0">
        {([
          { id: "favorites", label: "★ Favorites" },
          { id: "all", label: "All Stocks" },
        ] as { id: SidebarTab; label: string }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 pb-2 text-[11px] font-semibold transition-colors border-b-2 ${tab === t.id
                ? "border-amber-400 text-amber-400"
                : "border-transparent text-gray-600 hover:text-gray-400"
              }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Search input (always visible) */}
      <div className="px-3 py-2 flex-shrink-0">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600"
            fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder={isFavsTab ? "Filter favorites…" : "Search any NSE stock…"}
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-7 pr-3 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.06] transition-all"
          />
          {searching && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      </div>

      {/* List */}
      <nav className="flex-1 overflow-y-auto py-1 px-2">

        {/* Favorites empty state */}
        {isFavsTab && showList.length === 0 && !searching && (
          <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
            <span className="text-2xl">⭐</span>
            <p className="text-xs text-gray-500 leading-relaxed">
              No favorites yet.<br />
              Hit the <span className="text-amber-400">★</span> next to any stock to save it here.
            </p>
          </div>
        )}

        {/* All-tab empty state */}
        {!isFavsTab && showList.length === 0 && !searching && query.trim() && (
          <p className="text-xs text-gray-600 text-center py-6">No results for &ldquo;{query}&rdquo;</p>
        )}

        {showList.map(c => {
          const isFav = favs.has(c.symbol);
          const isActive = selected.symbol === c.symbol;
          return (
            <div key={c.symbol}
              role="button" tabIndex={0}
              onClick={() => onSelect(c)}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onSelect(c); }}
              className={`group w-full flex items-center gap-2 px-2 py-2.5 rounded-xl mb-0.5 text-left cursor-pointer transition-all ${isActive ? "bg-white/[0.08] text-white" : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]"
                }`}>

              {/* Star toggle — valid: <button> inside <div>, not inside <button> */}
              <button
                onClick={e => toggleFav(c.symbol, e)}
                title={isFav ? "Remove from favorites" : "Add to favorites"}
                className={`flex-shrink-0 p-0.5 rounded transition-all ${isFav
                    ? "text-amber-400 hover:text-amber-300"
                    : "text-gray-700 hover:text-amber-400 opacity-0 group-hover:opacity-100"
                  }`}>
                <Star filled={isFav} small />
              </button>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium leading-none truncate ${isActive ? "text-white" : ""}`}>{c.name}</p>
                <p className="text-[10px] text-gray-600 mt-0.5">{c.sector}</p>
              </div>

              {/* Ticker */}
              <span className={`text-[10px] font-mono font-bold flex-shrink-0 ${isActive ? "text-blue-400" : "text-gray-700"}`}>
                {c.symbol.replace("NSE:", "")}
              </span>
            </div>
          );
        })}
      </nav>
    </div>
  );
}

/* ══════════════════════════════════════════
   Main Dashboard
══════════════════════════════════════════ */
export default function Dashboard({ user: initialUser, onLogout }: { user: UserData; onLogout: () => void }) {
  const [user, setUser] = useState(initialUser);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(COMPANIES[0]);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [candleData, setCandleData] = useState<CandlePoint[]>([]);
  const [chartType, setChartType] = useState<"area" | "candle">("area");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [wsReady, setWsReady] = useState(false);
  const [mainTab, setMainTab] = useState<MainTab>("chart");
  const [tradeAction, setTradeAction] = useState<"buy" | "sell">("buy");

  // Quick-star state (reads from same localStorage)
  const [headerFavs, setHeaderFavs] = useState<Set<string>>(() => loadFavs(initialUser.email));

  // Mobile
  const [mobileTab, setMobileTab] = useState<MobileTab>("chart");
  const [marketsOpen, setMarketsOpen] = useState(false);
  const [portfolioOpen, setPortfolioOpen] = useState(false);

  /* keep headerFavs in sync whenever markets drawer closes (user might have toggled) */
  useEffect(() => {
    if (!marketsOpen) setHeaderFavs(loadFavs(user.email));
  }, [marketsOpen, user.email]);

  function toggleHeaderFav(e: React.MouseEvent) {
    e.stopPropagation();
    setHeaderFavs(prev => {
      const next = new Set(prev);
      next.has(selected.symbol) ? next.delete(selected.symbol) : next.add(selected.symbol);
      saveFavs(user.email, next);
      return next;
    });
  }

  // Poll server for user data changes
  useEffect(() => {
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (reason?.name === "ChunkLoadError" || /ChunkLoadError/.test(String(reason))) {
        console.warn("ChunkLoadError detected, reloading page to recover HMR state.");
        window.location.reload();
      }
    };
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    const poll = async () => {
      const res = await fetch(`/api/auth?email=${encodeURIComponent(user.email)}`).catch(() => null);
      if (!res?.ok) return;
      const data = await res.json();
      if (!data?.user) return;

      // Merge admin-pushed global favorites into this user's localStorage favorites
      if (Array.isArray(data.globalFavorites) && data.globalFavorites.length > 0) {
        const current = loadFavs(user.email);
        let changed = false;
        for (const sym of data.globalFavorites) {
          if (!current.has(sym)) { current.add(sym); changed = true; }
        }
        if (changed) {
          saveFavs(user.email, current);
          setHeaderFavs(new Set(current));
        }
      }

      setUser((prev: UserData) => {
        const combined = { ...prev, ...data.user };
        if (
          prev.eTokens !== combined.eTokens ||
          JSON.stringify(prev.portfolio) !== JSON.stringify(combined.portfolio) ||
          JSON.stringify(prev.options) !== JSON.stringify(combined.options)
        ) return combined;
        return prev;
      });
    };
    const interval = setInterval(poll, 20000);
    return () => { clearInterval(interval); window.removeEventListener("unhandledrejection", onUnhandledRejection); };
  }, [user.email]);

  const fetchHistory = useCallback(async (symbol: string, silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch(`/api/stock?symbol=${symbol}`);
      if (!res.ok) throw new Error("API response not OK");
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setQuote(data.quote);
      setChartData(data.chartData);
      setCandleData(data.candleData ?? []);
      if (!silent) { setLoading(false); setWsReady(true); }
    } catch (err) {
      console.warn("Stock fetch failed (likely rate limit), keeping last known good data:", err);
      if (!silent) setLoading(false);
      // We purposefully don't clear the state here so old data persists
    }
  }, []);

  useEffect(() => {
    setWsReady(false);
    fetchHistory(selected.symbol);
    const interval = setInterval(() => fetchHistory(selected.symbol, true), 20000);
    return () => clearInterval(interval);
  }, [selected, fetchHistory]);

  function handleSelectCompany(c: Company | string) {
    if (typeof c === "string") {
      const found = COMPANIES.find(x => x.symbol === c);
      if (found) setSelected(found);
      else setSelected({ name: c.replace("NSE:", ""), symbol: c, sector: "Unknown" });
    } else {
      setSelected(c);
    }
    setMarketsOpen(false);
    setMobileTab("chart");
    setMainTab("chart");
    setTradeAction("buy"); // reset to buy by default
  }

  function handleFocusSell() {
    setMainTab("chart");
    setMobileTab("chart");
    setTradeAction("sell");
  }

  const displayPrice = quote?.c ?? null;
  const isPositive = quote ? quote.d >= 0 : true;
  const accent = isPositive ? "#34d399" : "#f87171";
  const isHeaderFaved = headerFavs.has(selected.symbol);

  const stats = quote ? [
    { label: "Open", value: `₹${quote.o.toFixed(2)}` },
    { label: "High", value: `₹${quote.h.toFixed(2)}` },
    { label: "Low", value: `₹${quote.l.toFixed(2)}` },
    { label: "Prev Close", value: `₹${quote.pc.toFixed(2)}` },
  ] : [];

  const activeMobileTab = mobileTab === "options" ? "options" : "chart";

  /* shared sidebar content factory */
  const SidebarContent = (
    <CompanyList
      selected={selected}
      onSelect={handleSelectCompany}
      userEmail={user.email}
    />
  );

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
        {SidebarContent}
        <div className="px-4 py-4 border-t border-white/[0.06] flex-shrink-0">
          <button onClick={onLogout} className="w-full text-xs text-gray-600 hover:text-gray-300 transition-colors py-2 rounded-lg hover:bg-white/[0.04] flex items-center justify-center gap-1.5">
            <span>↩</span> Sign out
          </button>
        </div>
      </Drawer>

      <Drawer open={portfolioOpen} onClose={() => setPortfolioOpen(false)} side="right">
        <PortfolioPanel user={user} onUserUpdate={setUser} onClose={() => setPortfolioOpen(false)} onSelectCompany={handleSelectCompany} onFocusSell={handleFocusSell} />
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
            {SidebarContent}
            <div className="px-4 py-4 border-t border-white/[0.06]">
              <button onClick={onLogout} className="w-full text-xs text-gray-600 hover:text-gray-300 transition-colors py-2 rounded-lg hover:bg-white/[0.04] flex items-center justify-center gap-1.5">
                <span>↩</span> Sign out
              </button>
            </div>
          </aside>

      {/* Main Content */}
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
                  <div className="flex items-center gap-2">
                    <h1 className="text-sm sm:text-lg font-bold text-white leading-none truncate">{selected.name}</h1>
                    {/* Quick-star toggle in header */}
                    <button
                      onClick={toggleHeaderFav}
                      title={isHeaderFaved ? "Remove from favorites" : "Add to favorites"}
                      className={`flex-shrink-0 transition-all duration-200 ${isHeaderFaved ? "text-amber-400 scale-110" : "text-gray-600 hover:text-amber-400"
                        }`}>
                      <Star filled={isHeaderFaved} />
                    </button>
                  </div>
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 truncate">{selected.sector} · {selected.symbol}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
                <div className={`flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-[11px] px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border ${wsReady ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" : "border-yellow-500/30 text-yellow-400 bg-yellow-500/10"
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
                { id: "chart", label: "Chart & Trade" },
                { id: "options", label: "Options Chain" },
              ] as { id: MainTab; label: string }[]).map(t => (
                <button key={t.id} onClick={() => setMainTab(t.id)}
                  className={`px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${mainTab === t.id ? "border-blue-500 text-white" : "border-transparent text-gray-500 hover:text-gray-300"
                    }`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className={`flex-1 flex-col overflow-hidden ${mainTab === "chart" ? "flex" : "hidden"} sm:flex ${mainTab !== "chart" ? "sm:hidden" : ""}`}>
                <ChartArea
                  chartType={chartType} setChartType={setChartType}
                  chartData={chartData} candleData={candleData}
                  loading={loading} accent={accent} isPositive={isPositive}
                />
                <TradePanel user={user} company={selected} price={displayPrice} defaultAction={tradeAction} onTradeSuccess={setUser} />
              </div>

              <div className={`flex-1 overflow-hidden ${mainTab === "options" ? "flex flex-col" : "hidden"} sm:flex sm:flex-col ${mainTab !== "options" ? "sm:hidden" : ""}`}>
                <OptionsChain
                  symbol={selected.symbol} company={selected}
                  user={user} underlyingPrice={displayPrice ?? 0}
                  onTradeSuccess={setUser}
                />
              </div>
            </div>
          <nav className="sm:hidden flex border-t border-white/[0.06] bg-black/40 backdrop-blur-xl flex-shrink-0">
            {([
              { id: "markets", label: "Markets", icon: "📊" },
              { id: "chart", label: "Chart", icon: "📈" },
              { id: "options", label: "Options", icon: "⚡" },
              { id: "portfolio", label: "Portfolio", icon: "💼" },
            ] as { id: MobileTab; label: string; icon: string }[]).map(tab => (
              <button key={tab.id}
                onClick={() => {
                  if (tab.id === "markets") { setMarketsOpen(true); return; }
                  if (tab.id === "portfolio") { setPortfolioOpen(true); return; }
                  setMobileTab(tab.id);
                  setMainTab(tab.id as MainTab);
                }}
                className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 text-[10px] font-medium transition-colors ${activeMobileTab === tab.id ? "text-blue-400" : "text-gray-600 hover:text-gray-400"
                  }`}>
                <span className="text-base">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </main>

        {/* Right Panel - Portfolio */}
        <aside className="hidden lg:flex relative z-10 w-64 flex-shrink-0 flex-col border-l border-white/[0.06] bg-black/30 backdrop-blur-xl">
          <PortfolioPanel user={user} onUserUpdate={setUser} onSelectCompany={handleSelectCompany} onFocusSell={handleFocusSell} />
        </aside>

    </div>
  );
}
