"use client";
import { useState, useEffect, useCallback, useRef, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, TrendingUp, Wallet, Star as StarIcon, LogOut, ChevronRight, Search, Activity, Target, Plus, Sparkles, Send, AlertCircle } from "lucide-react";
import { getAIInsight } from "@/app/actions/ai-insight";
import NeuralBackground from "@/components/ui/NeuralBackground";
import dynamic from "next/dynamic";
const RechargeModal = dynamic(() => import("./RechargeModal"), { ssr: false });
const ChartArea     = dynamic(() => import("./ChartArea"),     { ssr: false });
const TradePanel    = dynamic(() => import("./TradePanel"),    { ssr: false });
const PortfolioPanel = dynamic(() => import("./PortfolioPanel"), { ssr: false });
const ProfileDropdown = dynamic(() => import("./ProfileDropdown"), { ssr: false });
const EditProfileModal = dynamic(() => import("./EditProfileModal"), { ssr: false });
const OptionsChain   = dynamic(() => import("./OptionsChain"),   { ssr: false });
import ThemeToggle from "@/components/ui/ThemeToggle";

import Tilt from "@/components/ui/Tilt";
import { cn } from "@/lib/utils";
import { COMPANIES } from "@/lib/constants";
import type { UserData, ChartPoint, CandlePoint, Quote, Company } from "@/lib/types";
import { formatAmount } from "@/lib/format";
import { supabase, safeUser } from "@/lib/supabase";

type MainTab = "chart" | "options";
type MobileTab = "markets" | "chart" | "options" | "portfolio";
type SidebarTab = "favorites" | "all";

const premiumTransition = { type: "spring", damping: 28, stiffness: 200, mass: 0.4 } as const;
const fluidEase = { type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.5 } as const;
const quickFade = { type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.2 } as const;
const staggerContainer = {
  hidden: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.1
    }
  }
} as const;
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: premiumTransition }
} as const;
const sidebarLeftVariants = {
  hidden: { opacity: 0, x: -24 },
  animate: { opacity: 1, x: 0, transition: premiumTransition }
} as const;
const sidebarRightVariants = {
  hidden: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0, transition: premiumTransition }
} as const;

/* ── helpers ── */
function favKey(email: string) { return `stockpulse_favs_${email}`; }

interface FavData {
  symbols: string[];
  registry?: Company[];
}

function loadFavs(email: string): { symbols: Set<string>; registry: Record<string, Company> } {
  try {
    const raw = localStorage.getItem(favKey(email));
    if (!raw) return { symbols: new Set(), registry: {} };
    const data = JSON.parse(raw) as (string[] | FavData);
    
    // Compatibility: If old format (just string array)
    if (Array.isArray(data)) {
      return { symbols: new Set(data), registry: {} };
    }
    
    const registry: Record<string, Company> = {};
    (data.registry || []).forEach(c => { registry[c.symbol] = c; });
    
    return { 
      symbols: new Set(data.symbols || []), 
      registry 
    };
  } catch { 
    return { symbols: new Set(), registry: {} }; 
  }
}

function saveFavs(email: string, symbols: Set<string>, registry: Record<string, Company>) {
  const data: FavData = {
    symbols: Array.from(symbols),
    registry: Object.values(registry).filter(c => symbols.has(c.symbol))
  };
  localStorage.setItem(favKey(email), JSON.stringify(data));
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
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-md z-40 lg:hidden"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: side === "left" ? "-100%" : "100%" }}
            animate={{ x: 0 }}
            exit={{ x: side === "left" ? "-100%" : "100%" }}
            transition={premiumTransition}
            className={`fixed top-0 ${side === "left" ? "left-0" : "right-0"} h-full w-80 bg-background/90 backdrop-blur-3xl border-${side === "left" ? "r" : "l"} border-border z-50 flex flex-col shadow-2xl`}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── CompanyList ── */
const CompanyList = memo(({ selected, onSelect, userEmail, className }: {
  selected: any;
  onSelect: (c: any) => void;
  userEmail: string;
  className?: string;
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Company[]>(COMPANIES);
  const [searching, setSearching] = useState(false);
  const [tab, setTab] = useState<SidebarTab>("all");
  const [favs, setFavs] = useState<Set<string>>(() => loadFavs(userEmail).symbols);
  const [customRegistry, setCustomRegistry] = useState<Record<string, Company>>(() => loadFavs(userEmail).registry);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { 
    saveFavs(userEmail, favs, customRegistry); 
  }, [favs, customRegistry, userEmail]);

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

  function toggleFav(c: Company, e: React.MouseEvent) {
    e.stopPropagation();
    const symbol = c.symbol;
    const isDefault = COMPANIES.some(x => x.symbol === symbol);

    setFavs(prev => {
      const next = new Set(prev);
      const isAdding = !next.has(symbol);
      
      if (isAdding) {
        next.add(symbol);
        // If it's a searched/custom asset, add its metadata to registry
        if (!isDefault) {
          setCustomRegistry(reg => ({ ...reg, [symbol]: c }));
        }
      } else {
        next.delete(symbol);
        // We can keep it in registry even if unstarred, or clean it up. Let's keep for stability.
      }
      return next;
    });
  }

  const isFavsTab = tab === "favorites";
  
  // Merge default companies with any custom starred companies to ensure full list for rendering
  const unifiedBase = [...COMPANIES];
  Object.values(customRegistry).forEach(c => {
    if (!unifiedBase.some(x => x.symbol === c.symbol)) {
      unifiedBase.push(c);
    }
  });

  const baseList = query.trim() ? results : unifiedBase;
  const showList = isFavsTab ? unifiedBase.filter(c => favs.has(c.symbol)) : baseList;

  return (
    <div className={cn("flex flex-col flex-1 overflow-hidden", className)}>
      <div className="flex border-b border-border bg-background/20 px-4 pt-2 flex-shrink-0">
        {(["all", "favorites"] as SidebarTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn(
              "flex-1 pb-3 text-xs font-black uppercase tracking-[0.2em] transition-all relative",
              tab === t ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}>
            {t === "favorites" ? "Starred" : "All Assets"}
            {tab === t && (
              <motion.div layoutId="sidebar-tab" className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-primary shadow-[0_0_8px_rgba(59,130,246,0.3)]" />
            )}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 flex-shrink-0 bg-background/40">
        <div className="relative group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder={isFavsTab ? "Filter starred…" : "Quick search…"}
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-secondary/80 border border-border rounded-2xl pl-10 pr-4 py-2.5 text-sm font-bold text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
          />
          {searching && (
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      </div>

      <motion.nav
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="flex-1 overflow-y-auto py-2 px-3 space-y-1 custom-scrollbar"
      >
        {isFavsTab && showList.length === 0 && !searching && (
          <div className="flex flex-col items-center gap-3 py-12 px-6 text-center opacity-60">
            <div className="p-4 rounded-full bg-secondary">
              <StarIcon size={24} className="text-muted-foreground" />
            </div>
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground leading-loose">
              No favorites tracked.<br />
              Mark assets with <span className="text-amber-500">★</span> for quick access.
            </p>
          </div>
        )}

        {showList.map((c, idx) => {
          const isFav = favs.has(c.symbol);
          const isActive = selected.symbol === c.symbol;
          return (
            <motion.div key={c.symbol}
              layout
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(idx * 0.02, 0.4) }}
              role="button" tabIndex={0}
              onClick={() => onSelect(c)}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onSelect(c); }}
              className={cn(
                "group w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left cursor-pointer transition-all border",
                isActive
                  ? "bg-primary/5 text-primary border-primary/20 shadow-xl shadow-primary/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border-transparent"
              )}>
              <button
                onClick={e => toggleFav(c, e)}
                className={cn(
                  "flex-shrink-0 p-1.5 rounded-lg transition-all",
                  isFav
                    ? "text-amber-500 bg-amber-500/10"
                    : "text-muted-foreground/30 hover:text-amber-500 opacity-0 group-hover:opacity-100"
                )}>
                <Star filled={isFav} small />
              </button>

              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-black leading-tight truncate uppercase tracking-tighter", isActive ? "text-primary" : "text-foreground")}>{c.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{c.sector}</span>
                </div>
              </div>

              <span className={cn(
                "text-[11px] font-mono font-black flex-shrink-0 px-2 py-0.5 rounded-lg border",
                isActive ? "text-primary bg-primary/10 border-primary/20" : "text-muted-foreground bg-secondary/50 border-border/50"
              )}>
                {c.symbol.replace("NSE:", "").replace("BSE:", "")}
              </span>
            </motion.div>
          );
        })}
      </motion.nav>
    </div>
  );
});

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
  const [headerFavs, setHeaderFavs] = useState<Set<string>>(() => loadFavs(initialUser?.email || "").symbols);
  const [headerRegistry, setHeaderRegistry] = useState<Record<string, Company>>(() => loadFavs(initialUser?.email || "").registry);
  const [mobileTab, setMobileTab] = useState<MobileTab>("chart");
  const [marketsOpen, setMarketsOpen] = useState(false);
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [rechargeOpen, setRechargeOpen] = useState(false);

  /* ── AI Insight State ── */
  const [aiTicker, setAiTicker] = useState("");
  const [aiResult, setAiResult] = useState<{ 
    summary?: string; 
    sentimentTag?: "BULLISH" | "BEARISH" | "NEUTRAL"; 
    error?: string 
  } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  async function handleAIInsight(e?: React.FormEvent) {
    e?.preventDefault();
    const ticker = aiTicker.trim() || selected.symbol.replace("NSE:", "");
    if (!ticker) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const result = await getAIInsight(ticker);
      setAiResult(result);
    } catch {
      setAiResult({ error: "Network error. Please check your connection." });
    } finally {
      setAiLoading(false);
    }
  }

  useEffect(() => {
    if (!marketsOpen) {
      const { symbols, registry } = loadFavs(user.email);
      setHeaderFavs(symbols);
      setHeaderRegistry(registry);
    }
  }, [marketsOpen, user.email]);

  function toggleHeaderFav(e: React.MouseEvent) {
    e.stopPropagation();
    const symbol = selected.symbol;
    const isDefault = COMPANIES.some(x => x.symbol === symbol);

    setHeaderFavs(prev => {
      const next = new Set(prev);
      const isAdding = !next.has(symbol);
      let nextReg = { ...headerRegistry };

      if (isAdding) {
        next.add(symbol);
        if (!isDefault) nextReg[symbol] = selected;
      } else {
        next.delete(symbol);
      }
      
      setHeaderRegistry(nextReg);
      saveFavs(user.email, next, nextReg);
      return next;
    });
  }

  useEffect(() => {
    // 1. Listen for database updates on this specific user's row
    const userChannel = supabase
      .channel(`user-updates-${user.email}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `email=eq.${user.email}`,
        },
        (payload) => {
          if (payload.new) {
            const updated = safeUser(payload.new);
            setUser((prev: UserData) => {
              const combined = { ...prev, ...updated };
              if (
                prev.eTokens !== combined.eTokens ||
                JSON.stringify(prev.portfolio) !== JSON.stringify(combined.portfolio) ||
                JSON.stringify(prev.options) !== JSON.stringify(combined.options)
              ) {
                return combined;
              }
              return prev;
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'users',
          filter: `email=eq.${user.email}`,
        },
        () => {
          onLogout();
        }
      )
      .subscribe();

    // 2. Listen for global config updates (e.g. global_favorites)
    const configChannel = supabase
      .channel('global-config-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_config',
          filter: "key=eq.global_favorites",
        },
        (payload) => {
          const val = (payload.new as any)?.value;
          if (Array.isArray(val)) {
            const { symbols: current, registry: reg } = loadFavs(user.email);
            let changed = false;
            for (const sym of val) {
              if (!current.has(sym)) { current.add(sym); changed = true; }
            }
            if (changed) {
              saveFavs(user.email, current, reg);
              setHeaderFavs(new Set(current));
            }
          }
        }
      )
      .subscribe();

    // Fetch initial global favorites on mount
    const fetchGlobalFavorites = async () => {
      try {
        const { data } = await supabase
          .from('app_config')
          .select('value')
          .eq('key', 'global_favorites')
          .maybeSingle();
        const val = data?.value;
        if (Array.isArray(val)) {
          const { symbols: current, registry: reg } = loadFavs(user.email);
          let changed = false;
          for (const sym of val) {
            if (!current.has(sym)) { current.add(sym); changed = true; }
          }
          if (changed) {
            saveFavs(user.email, current, reg);
            setHeaderFavs(new Set(current));
          }
        }
      } catch (err) {
        console.error("Error fetching global favorites:", err);
      }
    };
    fetchGlobalFavorites();

    return () => {
      supabase.removeChannel(userChannel);
      supabase.removeChannel(configChannel);
    };
  }, [user.email, onLogout]);

  const fetchHistory = useCallback(async (symbol: string, silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch(`/api/stock?symbol=${encodeURIComponent(symbol)}`);
      if (!res.ok) throw new Error("API response not OK");
      const data = await res.json();
      setQuote(data.quote);
      setChartData(data.chartData);
      setCandleData(data.candleData ?? []);
      if (!silent) { setLoading(false); setWsReady(true); }
    } catch (err) {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setWsReady(false);
    fetchHistory(selected.symbol);

    let intervalId: any = null;

    const startInterval = () => {
      fetchHistory(selected.symbol, true);
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(() => fetchHistory(selected.symbol, true), 20000);
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
      stopInterval();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [selected, fetchHistory]);

  function handleSelectCompany(c: Company | string) {
    // Clear state to prevent stale data (like Nifty 50) while loading new asset
    setQuote(null);
    setChartData([]);
    setCandleData([]);
    setLoading(true);

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
    setTradeAction("buy");
  }

  function handleFocusSell() {
    setMainTab("chart");
    setMobileTab("chart");
    setTradeAction("sell");
  }

  const displayPrice = quote?.c ?? null;
  const isPositive = quote ? quote.d >= 0 : true;
  const accent = isPositive ? "#10b981" : "#ef4444";
  const isHeaderFaved = headerFavs.has(selected.symbol);

  const stats = quote ? [
    { label: "Open", value: `₹${quote.o.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    { label: "High", value: `₹${quote.h.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    { label: "Low", value: `₹${quote.l.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    { label: "Prev Close", value: `₹${quote.pc.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
  ] : [];

  const activeMobileTab = mobileTab === "options" ? "options" : "chart";

  const SidebarContent = (
    <CompanyList
      selected={selected}
      onSelect={handleSelectCompany}
      userEmail={user.email}
    />
  );

  return (
    <motion.div
      initial="hidden"
      animate="animate"
      variants={staggerContainer}
      className="relative flex h-screen overflow-hidden bg-background"
    >
      <NeuralBackground />
      <AnimatePresence>
        {editing && <EditProfileModal user={user} onUpdate={setUser} onClose={() => setEditing(false)} />}
      </AnimatePresence>

      <RechargeModal
        isOpen={rechargeOpen}
        onClose={() => setRechargeOpen(false)}
        userEmail={user.email}
        userName={user.name}
      />

      <Drawer open={marketsOpen} onClose={() => setMarketsOpen(false)} side="left">
        <div className="px-6 py-6 border-b border-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <span className="font-extrabold gradient-text-premium text-xl tracking-tighter uppercase">StockPulse</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="sm:hidden flex-shrink-0 scale-90 origin-right">
              <ThemeToggle />
            </div>
            <button onClick={() => setMarketsOpen(false)} className="p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>
        {SidebarContent}
        <div className="px-6 py-6 border-t border-border flex-shrink-0 bg-background/40">
          <button onClick={onLogout} className="w-full text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all py-4 rounded-2xl hover:bg-muted/50 flex items-center justify-center gap-3 border border-transparent hover:border-border">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </Drawer>

      <Drawer open={portfolioOpen} onClose={() => setPortfolioOpen(false)} side="right">
        <PortfolioPanel
          user={user}
          onUserUpdate={setUser}
          onClose={() => setPortfolioOpen(false)}
          onSelectCompany={handleSelectCompany}
          onFocusSell={handleFocusSell}
          onRechargeOpen={() => setRechargeOpen(true)}
        />
      </Drawer>

      <motion.aside variants={sidebarLeftVariants} className="hidden lg:flex relative z-10 w-[300px] flex-shrink-0 flex-col border-r border-border glass-premium shadow-2xl">
        {/* Brand Header */}
        <div className="px-6 py-6 border-b border-border relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
          <div className="relative flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-primary/15 border border-primary/25 shadow-[0_0_16px_rgba(99,102,241,0.2)]">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <span className="font-black gradient-text-premium text-xl tracking-tighter uppercase">StockPulse</span>
          </div>
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setEditing(true)}>
            <span className="live-dot flex-shrink-0" />
            <p className="text-[11px] text-muted-foreground font-black uppercase tracking-widest group-hover:text-primary transition-colors">
              {user.name.split(" ")[0]} · Active
            </p>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {SidebarContent}
        </div>

        <div className="px-4 py-4 border-t border-border">
          <button
            onClick={onLogout}
            className="w-full text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-destructive transition-all py-3 rounded-xl hover:bg-destructive/5 flex items-center justify-center gap-2 border border-transparent hover:border-destructive/20"
          >
            <LogOut size={13} /> End Session
          </button>
        </div>
      </motion.aside>

      <main className="relative z-10 flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="relative z-50 flex items-center justify-between px-3 sm:px-8 py-3 sm:py-4 border-b border-border glass-premium !overflow-visible">
          <motion.div variants={itemVariants} className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button onClick={() => setMarketsOpen(true)} className="lg:hidden text-muted-foreground hover:text-foreground p-2 rounded-xl bg-secondary/80 border border-border flex-shrink-0">
              <Menu size={18} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-3">
                <h1 className="text-base sm:text-xl font-black text-foreground leading-none truncate tracking-tight uppercase max-w-[180px] sm:max-w-none">{selected.name}</h1>
                <button
                  onClick={toggleHeaderFav}
                  className={cn(
                    "flex-shrink-0 p-1 sm:p-1.5 rounded-lg transition-all",
                    isHeaderFaved ? "text-amber-400 bg-amber-400/10 shadow-[0_0_12px_rgba(251,191,36,0.3)]" : "text-muted-foreground/30 hover:text-amber-400 hover:bg-amber-400/5"
                  )}>
                  <StarIcon size={13} fill={isHeaderFaved ? "currentColor" : "none"} className="sm:w-4 sm:h-4" />
                </button>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 sm:mt-1">
                <span className="text-[10px] sm:text-[11px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded-md border border-primary/15 tracking-widest">{selected.symbol.replace("NSE:", "").replace("BSE:", "")}</span>
                <p className="hidden sm:block text-[11px] text-muted-foreground font-bold uppercase tracking-[0.2em] opacity-50 truncate">{selected.sector}</p>
              </div>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="flex items-center gap-1.5 sm:gap-4 flex-shrink-0">
            {/* Premium Live indicator */}
            {/* <div className={cn(
                  "flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest",
                  wsReady
                    ? "border-emerald-500/25 text-emerald-500 bg-emerald-500/8 shadow-[0_0_16px_rgba(16,185,129,0.15)]"
                    : "border-amber-500/25 text-amber-500 bg-amber-500/8"
                )}>
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full flex-shrink-0",
                    wsReady ? "live-dot" : "bg-amber-500"
                  )} />
                  <span className="hidden sm:block">{wsReady ? "Live" : "Syncing"}</span>
                </div> */}

            {/* Premium Wallet */}
            <div className="flex items-center gap-1.5 sm:gap-2 pl-2 sm:pl-3 pr-1 py-1.5 rounded-xl bg-primary/5 border border-primary/15 text-foreground font-black text-xs sm:text-sm shadow-[var(--shadow-glow-sm)] hover:border-primary/30 hover:bg-primary/8 transition-all group">
              <Wallet size={13} className="text-primary flex-shrink-0" />
              <span className="sm:inline font-mono tabular-nums tracking-tight text-primary truncate max-w-[70px] sm:max-w-none">
                ₹{(user.eTokens ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <button
                onClick={() => setRechargeOpen(true)}
                className="ml-0.5 sm:ml-1 p-1.5 rounded-lg bg-primary text-primary-foreground hover:brightness-110 transition-all active:scale-90 shadow-sm"
                title="Recharge Virtual Cash"
              >
                <Plus size={12} strokeWidth={3} />
              </button>
            </div>

            <div className="hidden md:block h-6 w-px bg-border/60 mx-0.5" />
            <div className="hidden sm:block"><ThemeToggle /></div>
            <ProfileDropdown user={user} onLogout={onLogout} onEditOpen={() => setEditing(true)} />
          </motion.div>
        </header>

        {/* Start Universal Scrolling Wrapper */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col relative z-0 min-h-0">
          {/* Price bar */}
        <motion.div variants={itemVariants} className="flex items-center gap-4 sm:gap-8 px-4 sm:px-8 py-3 sm:py-4 border-b border-border flex-shrink-0 overflow-x-auto relative" style={{ background: 'linear-gradient(90deg, rgba(var(--primary-rgb, 79,70,229),0.02) 0%, transparent 100%)' }}>
          <div className="flex items-baseline gap-2 sm:gap-3 flex-shrink-0">
            <motion.span
              key={displayPrice}
              initial={{ opacity: 0.6, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="text-2xl sm:text-[2.5rem] font-black text-foreground tabular-nums leading-none tracking-tighter whitespace-nowrap"
            >
              {displayPrice ? formatAmount(displayPrice, { compact: false }) : "—"}
            </motion.span>
            {quote && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  "text-[11px] sm:text-xs font-black flex items-center gap-1 px-2 py-1 rounded-lg",
                  isPositive
                    ? "text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_16px_rgba(16,185,129,0.15)]"
                    : "text-destructive bg-destructive/10 border border-destructive/20"
                )}>
                {isPositive ? "▲" : "▼"} {Math.abs(quote.d).toFixed(2)}
                <span className="hidden xs:inline opacity-70">({Math.abs(quote.dp).toFixed(2)}%)</span>
              </motion.div>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-6 border-l border-border pl-8">
            {stats.map(s => (
              <div key={s.label} className="flex-shrink-0 group">
                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest leading-none mb-1.5 opacity-40">{s.label}</p>
                <p className="text-sm font-black text-foreground tabular-nums tracking-tight group-hover:text-primary transition-colors">{s.value}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── AI Insight Panel ── */}
        <motion.div variants={itemVariants} className="px-4 sm:px-8 py-3 sm:py-4 border-b border-border flex-shrink-0 overflow-hidden">
          <form onSubmit={handleAIInsight} className="glass-premium rounded-2xl p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20">
                <Sparkles size={14} className="text-primary" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground">AI Sentiment Analysis</h3>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  placeholder={`Ticker e.g. ${selected.symbol.replace("NSE:", "")}`}
                  value={aiTicker}
                  onChange={e => setAiTicker(e.target.value.toUpperCase())}
                  className="w-full bg-secondary/80 border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm font-bold text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all font-mono tracking-tight uppercase"
                  disabled={aiLoading}
                />
              </div>
              <button
                type="submit"
                disabled={aiLoading}
                className="btn-premium flex items-center gap-2 !px-4 !py-2.5 !rounded-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
              >
                {aiLoading ? (
                  <span className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send size={13} />
                )}
                <span className="hidden sm:inline">Analyze</span>
              </button>
            </div>

            <AnimatePresence mode="wait">
              {aiLoading && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={quickFade}
                  className="mt-3 flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/5 border border-primary/10"
                >
                  <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Generating insight…</p>
                </motion.div>
              )}

              {!aiLoading && aiResult?.error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={premiumTransition}
                  className="mt-3 flex items-start gap-3 px-4 py-3 rounded-xl bg-destructive/5 border border-destructive/15"
                >
                  <AlertCircle size={14} className="text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-destructive/90 leading-relaxed">{aiResult.error}</p>
                </motion.div>
              )}

              {!aiLoading && aiResult?.summary && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={premiumTransition}
                  className="mt-3 relative"
                >
                  <div className="px-4 py-3 rounded-xl bg-secondary/60 border border-border/80 relative overflow-hidden">
                    {/* Dynamic accent color based on sentiment */}
                    <div className={cn(
                      "absolute top-0 left-0 w-1 h-full rounded-full transition-colors duration-500",
                      aiResult.sentimentTag === "BULLISH" ? "bg-emerald-500" :
                      aiResult.sentimentTag === "BEARISH" ? "bg-destructive" : "bg-primary"
                    )} />
                    
                    <div className="flex items-center justify-between mb-2 pl-3">
                      <div className={cn(
                        "px-2.5 py-1 rounded-md text-[10px] font-black tracking-widest border",
                        aiResult.sentimentTag === "BULLISH" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                        aiResult.sentimentTag === "BEARISH" ? "bg-destructive/10 text-destructive border-destructive/20" :
                        "bg-primary/10 text-primary border-primary/20"
                      )}>
                        {aiResult.sentimentTag}
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm font-medium text-foreground/90 leading-relaxed pl-3">
                      {aiResult.summary}
                    </p>
                    <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 pl-3">AI-generated · Not financial advice</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </motion.div>

        {/* Premium Tab Bar — also has Holdings button on tablet (sm–xl) */}
        <motion.div variants={itemVariants} className="hidden sm:flex border-b border-border bg-background/80 backdrop-blur-xl flex-shrink-0 px-8 gap-1 items-center justify-between sticky top-0 z-20">
          <div className="flex gap-1">
            {([
              { id: "chart", label: "Asset Analysis" },
              { id: "options", label: "Option Chain" },
            ] as { id: MainTab; label: string }[]).map(t => (
              <button key={t.id} onClick={() => setMainTab(t.id)}
                className={cn(
                  "px-5 py-3.5 text-xs font-black uppercase tracking-[0.2em] border-b-2 transition-all relative",
                  mainTab === t.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-primary/5"
                )}>
                {t.label}
                {mainTab === t.id && (
                  <motion.div
                    layoutId="desktop-tab"
                    className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-primary"
                    style={{ boxShadow: '0 0 12px rgba(99,102,241,0.6), 0 0 4px rgba(99,102,241,0.4)' }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Holdings button — only visible on tablet (sm → xl), hidden when right sidebar is present */}
          <button
            onClick={() => setPortfolioOpen(true)}
            className="xl:hidden flex items-center gap-2 px-4 py-2 mr-1 rounded-xl text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-all"
          >
            <Wallet size={14} />
            <span>Holdings</span>
            <ChevronRight size={12} className="opacity-60" />
          </button>
        </motion.div>

        <motion.div variants={itemVariants} className="flex-1 flex flex-col relative z-0">
          <div className={`flex-1 flex flex-col min-h-0 ${mainTab === "chart" ? "flex" : "hidden"} sm:flex ${mainTab !== "chart" ? "sm:hidden" : ""}`}>
            <div className="min-h-[350px] sm:min-h-[500px] flex-1 flex flex-col z-10 flex-shrink-0">
              <ChartArea
                chartType={chartType} setChartType={setChartType}
                chartData={chartData} candleData={candleData}
                loading={loading} accent={accent} isPositive={isPositive}
              />
            </div>
            <div className="flex-shrink-0 border-t border-border/50 sm:border-t-0 bg-background/20 mt-auto">
              <TradePanel user={user} company={selected} price={displayPrice} defaultAction={tradeAction} onTradeSuccess={setUser} />
            </div>
          </div>

          <div className={`flex-1 flex flex-col ${mainTab === "options" ? "flex" : "hidden"} sm:flex ${mainTab !== "options" ? "sm:hidden" : ""}`}>
            <OptionsChain
              symbol={selected.symbol} company={selected}
              user={user} underlyingPrice={displayPrice ?? 0}
              onTradeSuccess={setUser}
            />
          </div>
        </motion.div>

        </div> {/* End Universal Scrolling Wrapper */}

        {/* Premium Mobile Nav */}
        <nav className="sm:hidden flex border-t border-border bg-background/90 backdrop-blur-2xl flex-shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {[
            { id: "markets", label: "Markets", icon: <TrendingUp size={20} /> },
            { id: "chart", label: "Insight", icon: <Activity size={20} /> },
            { id: "options", label: "Chain", icon: <Target size={20} /> },
            { id: "portfolio", label: "Portfolio", icon: <Wallet size={20} /> },
          ].map(tab => (
            <button key={tab.id}
              onClick={() => {
                if (tab.id === "markets") { setMarketsOpen(true); return; }
                if (tab.id === "portfolio") { setPortfolioOpen(true); return; }
                setMobileTab(tab.id as MobileTab);
                setMainTab(tab.id as MainTab);
              }}
              className={cn(
                "flex-1 flex flex-col items-center py-3 gap-1 text-[11px] font-black uppercase tracking-widest relative transition-colors",
                activeMobileTab === tab.id ? "text-primary" : "text-muted-foreground"
              )}>
              {activeMobileTab === tab.id && (
                <motion.div
                  layoutId="mobile-tab-pill"
                  className="absolute top-0 inset-x-2 h-[2px] bg-primary rounded-full"
                  style={{ boxShadow: '0 0 8px rgba(99,102,241,0.5)' }}
                />
              )}
              <span className={cn("transition-all", activeMobileTab === tab.id && "scale-110")}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </main>

      <motion.aside variants={sidebarRightVariants} className="hidden xl:flex relative z-10 w-[420px] flex-shrink-0 flex-col border-l border-border glass-premium shadow-2xl overflow-hidden">
        <PortfolioPanel
          user={user}
          onUserUpdate={setUser}
          onSelectCompany={handleSelectCompany}
          onFocusSell={handleFocusSell}
          onRechargeOpen={() => setRechargeOpen(true)}
        />
      </motion.aside>
    </motion.div>
  );
}
