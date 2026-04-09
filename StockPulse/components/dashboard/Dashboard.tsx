"use client";
import { useState, useEffect, useCallback, useRef, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, TrendingUp, Wallet, Star as StarIcon, LogOut, ChevronRight, Search, Activity, Target, Plus } from "lucide-react";
import NeuralBackground from "@/components/ui/NeuralBackground";
import RechargeModal from "./RechargeModal";
import ChartArea from "./ChartArea";
import TradePanel from "./TradePanel";
import PortfolioPanel from "./PortfolioPanel";
import ProfileDropdown from "./ProfileDropdown";
import EditProfileModal from "./EditProfileModal";
import OptionsChain from "./OptionsChain";
import ThemeToggle from "@/components/ui/ThemeToggle";
import Tilt from "@/components/ui/Tilt";
import { cn } from "@/lib/utils";
import { COMPANIES } from "@/lib/constants";
import type { UserData, ChartPoint, CandlePoint, Quote, Company } from "@/lib/types";
import { formatAmount } from "@/lib/format";

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
  const [favs, setFavs] = useState<Set<string>>(() => loadFavs(userEmail));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { saveFavs(userEmail, favs); }, [favs, userEmail]);

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
    <div className={cn("flex flex-col flex-1 overflow-hidden", className)}>
      <div className="flex border-b border-border bg-background/20 px-4 pt-2 flex-shrink-0">
        {(["all", "favorites"] as SidebarTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn(
              "flex-1 pb-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative",
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
            className="w-full bg-secondary/80 border border-border rounded-2xl pl-10 pr-4 py-2.5 text-[11px] font-bold text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all md:text-sm"
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
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-loose">
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
                onClick={e => toggleFav(c.symbol, e)}
                className={cn(
                  "flex-shrink-0 p-1.5 rounded-lg transition-all",
                  isFav
                    ? "text-amber-500 bg-amber-500/10"
                    : "text-muted-foreground/30 hover:text-amber-500 opacity-0 group-hover:opacity-100"
                )}>
                <Star filled={isFav} small />
              </button>

              <div className="flex-1 min-w-0">
                <p className={cn("text-xs font-black leading-tight truncate uppercase tracking-tighter", isActive ? "text-primary" : "text-foreground")}>{c.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60">{c.sector}</span>
                </div>
              </div>

              <span className={cn(
                "text-[9px] font-mono font-black flex-shrink-0 px-2 py-0.5 rounded-lg border",
                isActive ? "text-primary bg-primary/10 border-primary/20" : "text-muted-foreground bg-secondary/50 border-border/50"
              )}>
                {c.symbol.replace("NSE:", "")}
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
  const [headerFavs, setHeaderFavs] = useState<Set<string>>(() => loadFavs(initialUser?.email || ""));
  const [mobileTab, setMobileTab] = useState<MobileTab>("chart");
  const [marketsOpen, setMarketsOpen] = useState(false);
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [rechargeOpen, setRechargeOpen] = useState(false);

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

  useEffect(() => {
    const poll = async () => {
      const res = await fetch(`/api/auth?email=${encodeURIComponent(user.email)}`).catch(() => null);
      if (!res?.ok) return;
      const data = await res.json();
      if (data.loggedOut) {
        onLogout();
        return;
      }
      if (!data?.user) return;

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
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, [user.email]);

  const fetchHistory = useCallback(async (symbol: string, silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch(`/api/stock?symbol=${symbol}`);
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
            <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest group-hover:text-primary transition-colors">
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
            className="w-full text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-destructive transition-all py-3 rounded-xl hover:bg-destructive/5 flex items-center justify-center gap-2 border border-transparent hover:border-destructive/20"
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
                <h1 className="text-sm sm:text-xl font-black text-foreground leading-none truncate tracking-tight uppercase max-w-[120px] sm:max-w-none">{selected.name}</h1>
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
                <span className="text-[7px] sm:text-[9px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded-md border border-primary/15 tracking-widest">{selected.symbol.replace("NSE:", "")}</span>
                <p className="hidden sm:block text-[9px] text-muted-foreground font-bold uppercase tracking-[0.2em] opacity-50 truncate">{selected.sector}</p>
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
            <div className="flex items-center gap-1.5 sm:gap-2 pl-2 sm:pl-3 pr-1 py-1.5 rounded-xl bg-primary/5 border border-primary/15 text-foreground font-black text-[10px] sm:text-xs shadow-[var(--shadow-glow-sm)] hover:border-primary/30 hover:bg-primary/8 transition-all group">
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
                  "text-[9px] sm:text-xs font-black flex items-center gap-1 px-2 py-1 rounded-lg",
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
                <p className="text-[8px] text-muted-foreground uppercase font-black tracking-widest leading-none mb-1.5 opacity-40">{s.label}</p>
                <p className="text-xs font-black text-foreground tabular-nums tracking-tight group-hover:text-primary transition-colors">{s.value}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Premium Tab Bar — also has Holdings button on tablet (sm–xl) */}
        <motion.div variants={itemVariants} className="hidden sm:flex border-b border-border bg-transparent flex-shrink-0 px-8 gap-1 items-center justify-between">
          <div className="flex gap-1">
            {([
              { id: "chart", label: "Asset Analysis" },
              { id: "options", label: "Option Chain" },
            ] as { id: MainTab; label: string }[]).map(t => (
              <button key={t.id} onClick={() => setMainTab(t.id)}
                className={cn(
                  "px-5 py-3.5 text-[10px] font-black uppercase tracking-[0.2em] border-b-2 transition-all relative",
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
            className="xl:hidden flex items-center gap-2 px-4 py-2 mr-1 rounded-xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-all"
          >
            <Wallet size={14} />
            <span>Holdings</span>
            <ChevronRight size={12} className="opacity-60" />
          </button>
        </motion.div>

        <motion.div variants={itemVariants} className="flex-1 flex flex-col overflow-hidden relative z-0 min-h-0 sm:min-h-0">
          <div className={`flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar sm:overflow-hidden ${mainTab === "chart" ? "flex" : "hidden"} sm:flex ${mainTab !== "chart" ? "sm:hidden" : ""}`}>
            <div className="min-h-[320px] sm:min-h-0 sm:flex-[4] flex flex-col z-10 flex-shrink-0 sm:flex-shrink">
              <ChartArea
                chartType={chartType} setChartType={setChartType}
                chartData={chartData} candleData={candleData}
                loading={loading} accent={accent} isPositive={isPositive}
              />
            </div>
            <div className="flex-shrink-0 border-t border-border/50 sm:border-t-0 bg-background/20 sm:mt-auto">
              <TradePanel user={user} company={selected} price={displayPrice} defaultAction={tradeAction} onTradeSuccess={setUser} />
            </div>
          </div>

          <div className={`flex-1 overflow-hidden ${mainTab === "options" ? "flex flex-col" : "hidden"} sm:flex sm:flex-col ${mainTab !== "options" ? "sm:hidden" : ""}`}>
            <OptionsChain
              symbol={selected.symbol} company={selected}
              user={user} underlyingPrice={displayPrice ?? 0}
              onTradeSuccess={setUser}
            />
          </div>
        </motion.div>

        {/* Premium Mobile Nav */}
        <nav className="sm:hidden flex border-t border-border bg-background/90 backdrop-blur-2xl flex-shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {[
            { id: "markets", label: "Markets", icon: <TrendingUp size={18} /> },
            { id: "chart", label: "Insight", icon: <Activity size={18} /> },
            { id: "options", label: "Chain", icon: <Target size={18} /> },
            { id: "portfolio", label: "Portfolio", icon: <Wallet size={18} /> },
          ].map(tab => (
            <button key={tab.id}
              onClick={() => {
                if (tab.id === "markets") { setMarketsOpen(true); return; }
                if (tab.id === "portfolio") { setPortfolioOpen(true); return; }
                setMobileTab(tab.id as MobileTab);
                setMainTab(tab.id as MainTab);
              }}
              className={cn(
                "flex-1 flex flex-col items-center py-3 gap-1 text-[9px] font-black uppercase tracking-widest relative transition-colors",
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
