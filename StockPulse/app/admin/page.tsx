"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { COMPANIES } from "@/lib/constants";
import type { Company } from "@/lib/types";

const API = "/api/admin";

type PortfolioItem = { symbol: string; amount: number; avgBuyPrice: number };
type OptionPosition = { id: string; contractSymbol: string; type: string; lots: number; premium: number; side: string };
type AdminUser = {
  name: string; email: string; branch: string; enrollment: string;
  eTokens: number; portfolio: PortfolioItem[]; options: OptionPosition[];
  tradeCount: number; optionTradeCount: number;
};
type Trade = {
  _id: string; email: string; action: string; symbol: string;
  amount: number; price: number; total: number; timestamp: string;
};
type OptionTrade = {
  _id: string; email: string; action: string; contractSymbol: string;
  lots: number; premium: number; total: number; timestamp: string;
};
type Stats = {
  totalUsers: number; totalTrades: number; totalOptionTrades: number;
  totalVolume: number; totalETokens: number;
};

type Tab = "users" | "trades" | "options" | "favorites" | "recharge";

type RechargeRequest = {
  id: string;
  user_email: string;
  user_name: string | null;
  requested_amount: number;
  description: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  resolved_at: string | null;
  admin_note: string | null;
};

function fmt(n: number) { return n.toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
function fmtDate(s: string) { return new Date(s).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }); }

// ── Login wall ────────────────────────────────────────────────────────────────
function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [pw, setPw]       = useState("");
  const [err, setErr]     = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr("");
    const res  = await fetch(`${API}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setErr(data.error);
    onLogin();
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="glass rounded-2xl p-8 w-full max-w-sm border border-white/[0.08]">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-2xl">🛡️</span>
          <div>
            <h1 className="text-white font-bold text-lg leading-none">Admin Panel</h1>
            <p className="text-gray-500 text-xs mt-0.5">StockPulse</p>
          </div>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <input
            type="password" placeholder="Admin password" value={pw}
            onChange={e => setPw(e.target.value)} required
            className="input-field w-full px-4 py-3 rounded-xl text-sm"
          />
          {err && <p className="text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2">{err}</p>}
          <button type="submit" disabled={loading} className="btn-primary py-3 rounded-xl text-white font-semibold text-sm">
            {loading ? "Verifying..." : "Enter Admin Panel"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div className="glass rounded-xl p-4 border border-white/[0.06]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-500 text-xs uppercase tracking-wider">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

// ── User detail modal ─────────────────────────────────────────────────────────
function UserModal({ user, onClose, onReset, onDelete }: {
  user: AdminUser;
  onClose: () => void;
  onReset: (email: string, amount: number) => void;
  onDelete: (email: string) => void;
}) {
  const [tokenInput, setTokenInput] = useState(String(user.eTokens));
  const [confirm, setConfirm]       = useState(false);

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0f0f1a] border border-white/[0.08] rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold">{user.name}</h2>
            <p className="text-gray-500 text-xs">{user.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-white text-xl">✕</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Info */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Branch",     value: user.branch },
              { label: "Enrollment", value: user.enrollment },
              { label: "E-Tokens",   value: `₹${fmt(user.eTokens)}` },
              { label: "Trades",     value: `${user.tradeCount} equity · ${user.optionTradeCount} options` },
            ].map(r => (
              <div key={r.label} className="bg-white/[0.03] rounded-lg p-3">
                <p className="text-gray-600 text-[10px] uppercase tracking-wider">{r.label}</p>
                <p className="text-white text-sm font-medium mt-0.5">{r.value}</p>
              </div>
            ))}
          </div>

          {/* Portfolio */}
          {user.portfolio.length > 0 && (
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Portfolio</p>
              <div className="space-y-1.5">
                {user.portfolio.map(p => (
                  <div key={p.symbol} className="flex justify-between items-center bg-white/[0.03] rounded-lg px-3 py-2">
                    <span className="text-white text-sm font-mono">{p.symbol.replace("NSE:", "")}</span>
                    <span className="text-gray-400 text-xs">{p.amount} shares @ ₹{fmt(p.avgBuyPrice)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Options */}
          {user.options.length > 0 && (
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Open Options</p>
              <div className="space-y-1.5">
                {user.options.map(o => (
                  <div key={o.id} className="flex justify-between items-center bg-white/[0.03] rounded-lg px-3 py-2">
                    <span className="text-white text-xs font-mono truncate max-w-[60%]">{o.contractSymbol}</span>
                    <span className="text-gray-400 text-xs">{o.lots} lots · ₹{fmt(o.premium)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reset tokens */}
          <div className="border border-white/[0.06] rounded-xl p-4">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">Reset E-Tokens</p>
            <div className="flex gap-2">
              <input
                type="number" value={tokenInput} onChange={e => setTokenInput(e.target.value)}
                className="input-field flex-1 px-3 py-2 rounded-lg text-sm"
              />
              <button
                onClick={() => { onReset(user.email, parseFloat(tokenInput)); onClose(); }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
              >
                Set
              </button>
            </div>
          </div>

          {/* Delete */}
          <div className="border border-red-500/20 rounded-xl p-4">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">Danger Zone</p>
            {!confirm ? (
              <button onClick={() => setConfirm(true)} className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm rounded-lg border border-red-500/20 transition-colors">
                Delete User
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => { onDelete(user.email); onClose(); }} className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg transition-colors">
                  Confirm Delete
                </button>
                <button onClick={() => setConfirm(false)} className="flex-1 py-2 bg-white/[0.05] text-gray-400 text-sm rounded-lg transition-colors">
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Favorites Manager ────────────────────────────────────────────────────────
function FavoritesManager() {
  const [globalFavs, setGlobalFavs]     = useState<string[]>([]);
  const [query, setQuery]               = useState("");
  const [searchRes, setSearchRes]       = useState<Company[]>([]);
  const [searching, setSearching]       = useState(false);
  const [saving, setSaving]             = useState(false);
  const [toast, setToast]               = useState<{ msg: string; ok: boolean } | null>(null);
  const [password, setPassword]         = useState("");
  const debounceRef                     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load current global favorites on mount
  useEffect(() => {
    fetch("/api/admin/favorites")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.favorites)) setGlobalFavs(d.favorites); });
  }, []);

  // Live search
  useEffect(() => {
    const q = query.trim();
    if (!q) { setSearchRes([]); setSearching(false); return; }
    setSearching(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/stocks/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setSearchRes(data.results ?? []);
      } catch { setSearchRes([]); }
      finally  { setSearching(false); }
    }, 350);
  }, [query]);

  function toggle(symbol: string) {
    setGlobalFavs(prev =>
      prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]
    );
  }

  async function broadcast() {
    if (!password) { setToast({ msg: "Enter admin password first", ok: false }); return; }
    setSaving(true);
    try {
      const res  = await fetch("/api/admin/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorites: globalFavs, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setToast({ msg: `✓ Pushed ${globalFavs.length} favorite(s) to all users`, ok: true });
    } catch (err: any) {
      setToast({ msg: err.message, ok: false });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 4000);
    }
  }

  // Merge search results + preset list for display in picker
  const pickerList = query.trim() ? searchRes : COMPANIES;
  const favObjs    = globalFavs.map(sym => {
    const found = COMPANIES.find(c => c.symbol === sym);
    return found ?? { name: sym.replace("NSE:", ""), symbol: sym, sector: "—" };
  });

  return (
    <div className="space-y-6">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-xl border ${
          toast.ok
            ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
            : "bg-red-500/20 border-red-500/30 text-red-300"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header card */}
      <div className="glass rounded-xl border border-amber-500/20 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-white font-bold flex items-center gap-2">⭐ Global Favorites Broadcast</h2>
            <p className="text-gray-500 text-xs mt-1">
              Choose stocks below, then click <span className="text-amber-400 font-semibold">Push to All Users</span>.
              These will be silently merged into every user&apos;s favorites list within 5 seconds.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="password"
              placeholder="Admin password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input-field px-3 py-2 rounded-lg text-sm w-40"
            />
            <button
              onClick={broadcast}
              disabled={saving || globalFavs.length === 0}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black text-sm font-bold rounded-lg transition-colors flex items-center gap-2"
            >
              {saving ? (
                <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : "⭐"}
              Push to All Users
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left: picker */}
        <div className="glass rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <p className="text-white text-sm font-semibold">Stock Picker</p>
            <span className="text-gray-600 text-xs">{pickerList.length} stocks</span>
          </div>
          <div className="px-3 py-2 border-b border-white/[0.06]">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600"
                fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="Search any NSE stock…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full input-field pl-7 pr-3 py-1.5 rounded-lg text-sm"
              />
              {searching && (
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          </div>
          <div className="overflow-y-auto max-h-80">
            {pickerList.map(c => {
              const added = globalFavs.includes(c.symbol);
              return (
                <div key={c.symbol}
                  role="button" tabIndex={0}
                  onClick={() => toggle(c.symbol)}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") toggle(c.symbol); }}
                  className={`flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors border-b border-white/[0.04] ${
                    added ? "bg-amber-500/10" : "hover:bg-white/[0.03]"
                  }`}>
                  <div>
                    <p className="text-white text-sm font-medium">{c.name}</p>
                    <p className="text-gray-600 text-xs">{c.sector} · {c.symbol.replace("NSE:", "")}</p>
                  </div>
                  <span className={`text-lg transition-transform ${added ? "text-amber-400 scale-110" : "text-gray-700"}`}>
                    {added ? "★" : "☆"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: selected favorites */}
        <div className="glass rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <p className="text-white text-sm font-semibold">Will be pushed ({globalFavs.length})</p>
            {globalFavs.length > 0 && (
              <button onClick={() => setGlobalFavs([])} className="text-xs text-gray-500 hover:text-red-400 transition-colors">
                Clear all
              </button>
            )}
          </div>
          <div className="overflow-y-auto max-h-80">
            {globalFavs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <span className="text-3xl">⭐</span>
                <p className="text-gray-600 text-sm">No stocks selected yet.<br />Click any stock on the left to add.</p>
              </div>
            ) : favObjs.map(c => (
              <div key={c.symbol} className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04] group">
                <div>
                  <p className="text-white text-sm font-medium">{c.name}</p>
                  <p className="text-gray-600 text-xs">{c.sector} · {c.symbol.replace("NSE:", "")}</p>
                </div>
                <button
                  onClick={() => toggle(c.symbol)}
                  className="text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-lg"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab]           = useState<Tab>("users");
  const [stats, setStats]       = useState<Stats | null>(null);
  const [users, setUsers]       = useState<AdminUser[]>([]);
  const [trades, setTrades]     = useState<Trade[]>([]);
  const [optTrades, setOptTrades] = useState<OptionTrade[]>([]);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [search, setSearch]     = useState("");
  const [airdropAmount, setAirdropAmount] = useState("");
  const [airdropPassword, setAirdropPassword] = useState("");
  const [airdropLoading, setAirdropLoading] = useState(false);
  const [airdropMsg, setAirdropMsg] = useState<{ text: string; isErr: boolean } | null>(null);
  const [tradesError, setTradesError] = useState<string | null>(null);
  const [tokenSort, setTokenSort] = useState<"asc" | "desc" | null>(null);
  const [rechargeRequests, setRechargeRequests] = useState<RechargeRequest[]>([]);
  const [rechargeLoading, setRechargeLoading] = useState(false);
  const [resolvePassword, setResolvePassword] = useState("");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveMsg, setResolveMsg] = useState<{ text: string; ok: boolean } | null>(null);
  
  // Selection states
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]); // emails
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]); // _ids
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]); // _ids

  const [bulkDeleting, setBulkDeleting] = useState(false);

  const load = useCallback(async () => {
    const ts = Date.now();
    const [sRes, uRes, tRes] = await Promise.all([
      fetch(`${API}/stats?t=${ts}`, { cache: 'no-store' }),
      fetch(`${API}/users?t=${ts}`, { cache: 'no-store' }),
      fetch(`${API}/trades?t=${ts}`, { cache: 'no-store' }),
    ]);
    setStats(await sRes.json());
    setUsers(await uRes.json());
    const td = await tRes.json();
    setTrades(td.trades || []);
    setOptTrades(td.optionTrades || []);
    if (td.error) setTradesError(td.error);

    // Load recharge requests
    const rRes = await fetch(`${API}/recharge?t=${ts}`, { cache: 'no-store' });
    if (rRes.ok) setRechargeRequests(await rRes.json());
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  async function handleReset(email: string, amount: number) {
    await fetch(`${API}/user/reset-tokens`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, amount }) });
    load();
  }

  async function handleDelete(email: string) {
    if (!confirm(`Are you sure you want to delete user ${email}?`)) return;
    await fetch(`${API}/user`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    load();
  }

  async function handleBulkDeleteUsers() {
    if (selectedUsers.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedUsers.length} users and all their data? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      await fetch(`${API}/user`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: selectedUsers })
      });
      setSelectedUsers([]);
      load();
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleBulkDeleteTrades(type: 'equity' | 'option') {
    const ids = type === 'equity' ? selectedTrades : selectedOptions;
    if (ids.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${ids.length} ${type} trades?`)) return;
    setBulkDeleting(true);
    try {
      await fetch(`${API}/trades`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          tradeIds: type === 'equity' ? ids : [], 
          optionTradeIds: type === 'option' ? ids : [] 
        })
      });
      if (type === 'equity') setSelectedTrades([]);
      else setSelectedOptions([]);
      load();
    } finally {
      setBulkDeleting(false);
    }
  }

  function toggleSelectAll(type: 'users' | 'trades' | 'options') {
    if (type === 'users') {
      if (selectedUsers.length === filteredUsers.length) setSelectedUsers([]);
      else setSelectedUsers(filteredUsers.map(u => u.email));
    } else if (type === 'trades') {
      if (selectedTrades.length === filteredTrades.length) setSelectedTrades([]);
      else setSelectedTrades(filteredTrades.map(t => t._id));
    } else {
      if (selectedOptions.length === filteredOpts.length) setSelectedOptions([]);
      else setSelectedOptions(filteredOpts.map(t => t._id));
    }
  }

  function toggleItemSelect(id: string, type: 'users' | 'trades' | 'options') {
    if (type === 'users') {
      setSelectedUsers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    } else if (type === 'trades') {
      setSelectedTrades(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    } else {
      setSelectedOptions(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    }
  }

  async function handleAirdrop(e: React.FormEvent) {
      e.preventDefault();
      if (!airdropPassword) { setAirdropMsg({ text: "Password required", isErr: true }); return; }
      if (!airdropAmount || parseFloat(airdropAmount) <= 0) { setAirdropMsg({ text: "Invalid amount", isErr: true }); return; }
      setAirdropLoading(true); setAirdropMsg(null);

      const res = await fetch(`${API}/airdrop`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: parseFloat(airdropAmount), password: airdropPassword })
      });
      const data = await res.json();
      setAirdropLoading(false);

      if (!res.ok) {
          setAirdropMsg({ text: data.error || "Failed", isErr: true });
      } else {
          setAirdropMsg({ text: `Success: Sent ₹${airdropAmount} to ${data.count} users!`, isErr: false });
          setAirdropAmount("");
          load(); // refresh data
      }
  }

  const filteredUsers  = users
    .filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => tokenSort === "asc" ? a.eTokens - b.eTokens : tokenSort === "desc" ? b.eTokens - a.eTokens : 0);
  const filteredTrades = trades.filter(t => t.email.toLowerCase().includes(search.toLowerCase()) || t.symbol?.toLowerCase().includes(search.toLowerCase()));
  const filteredOpts   = optTrades.filter(t => t.email.toLowerCase().includes(search.toLowerCase()) || t.contractSymbol?.toLowerCase().includes(search.toLowerCase()));

  const pendingCount = rechargeRequests.filter(r => r.status === 'pending').length;

  async function handleResolve(id: string, status: 'approved' | 'rejected') {
    if (!resolvePassword) { setResolveMsg({ text: 'Enter admin password', ok: false }); return; }
    setResolvingId(id);
    setResolveMsg(null);
    const res = await fetch(`${API}/recharge`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, password: resolvePassword }),
    });
    const data = await res.json();
    setResolvingId(null);
    if (!res.ok) { setResolveMsg({ text: data.error || 'Failed', ok: false }); return; }
    setResolveMsg({ text: status === 'approved' ? '✓ Approved & tokens credited!' : '✓ Request rejected.', ok: status === 'approved' });
    setTimeout(() => setResolveMsg(null), 4000);
    load();
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {selected && <UserModal user={selected} onClose={() => setSelected(null)} onReset={handleReset} onDelete={handleDelete} />}

      {/* Header */}
      <header className="border-b border-white/[0.06] bg-black/30 backdrop-blur-xl px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">🛡️</span>
          <div>
            <h1 className="font-bold gradient-text text-base leading-none">Admin Panel</h1>
            <p className="text-gray-600 text-[10px] mt-0.5">StockPulse</p>
          </div>
        </div>
        <button onClick={onLogout} className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/[0.04]">
          ↩ Logout
        </button>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard label="Users"          value={String(stats.totalUsers)}        icon="👥" color="text-blue-400" />
            <StatCard label="Equity Trades"  value={String(stats.totalTrades)}       icon="📈" color="text-emerald-400" />
            <StatCard label="Option Trades"  value={String(stats.totalOptionTrades)} icon="⚡" color="text-purple-400" />
            <StatCard label="Total Volume"   value={`₹${fmt(stats.totalVolume)}`}    icon="💰" color="text-amber-400" />
            <StatCard label="Total E-Tokens" value={`₹${fmt(stats.totalETokens)}`}   icon="🪙" color="text-cyan-400" />
          </div>
        )}

        {/* Search + Tabs */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex border-b border-white/[0.06]">
            {([
              { id: "users",     label: "Users" },
              { id: "trades",    label: "Trades" },
              { id: "options",   label: "Option Trades" },
              { id: "recharge",  label: "💳 Recharge" },
              { id: "favorites", label: "★ Favorites" },
            ] as { id: Tab; label: string }[]).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors relative ${
                  tab === t.id
                    ? t.id === "favorites" ? "border-amber-400 text-amber-400" : t.id === "recharge" ? "border-emerald-400 text-emerald-400" : "border-blue-500 text-white"
                    : "border-transparent text-gray-500 hover:text-gray-300"
                }`}>
                {t.label}
                {t.id === 'recharge' && pendingCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-[9px] font-black bg-emerald-500 text-black rounded-full leading-none">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>
          <input
            placeholder="Search by email, name, symbol…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="input-field px-3 py-2 rounded-lg text-sm w-full sm:w-64"
          />
        </div>

        {/* Users table */}
        {tab === "users" && (
          <div className="space-y-4">
              {/* Massive Airdrop Panel */}
              <div className="glass rounded-xl border border-cyan-500/20 p-5 mb-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                          <h3 className="text-white font-bold text-sm flex items-center gap-2">🎁 Global E-Token Airdrop</h3>
                          <p className="text-gray-500 text-xs mt-1">Send a specific amount of E-Tokens to EVERY registered user simultaneously.</p>
                      </div>
                      <form onSubmit={handleAirdrop} className="flex items-center gap-2 flex-wrap">
                          <input type="number" placeholder="Amount (eTokens)" value={airdropAmount} onChange={e => setAirdropAmount(e.target.value)} className="input-field px-3 py-2 rounded-lg text-sm w-36" required />
                          <input type="password" placeholder="Admin Password" value={airdropPassword} onChange={e => setAirdropPassword(e.target.value)} className="input-field px-3 py-2 rounded-lg text-sm w-36" required />
                          <button type="submit" disabled={airdropLoading} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold rounded-lg text-sm transition-colors flex items-center gap-2">
                              {airdropLoading ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "🚀"}
                              Airdrop All
                          </button>
                      </form>
                  </div>
                  {airdropMsg && <p className={`mt-3 text-xs font-medium ${airdropMsg.isErr ? "text-red-400" : "text-emerald-400"}`}>{airdropMsg.text}</p>}
              </div>

              {/* Bulk Actions Bar */}
              {selectedUsers.length > 0 && (
                <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 mb-4 animate-in fade-in slide-in-from-top-2">
                  <span className="text-blue-300 text-sm font-medium">{selectedUsers.length} users selected</span>
                  <button 
                    onClick={handleBulkDeleteUsers}
                    disabled={bulkDeleting}
                    className="px-4 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                  >
                    🗑️ Delete Selected
                  </button>
                </div>
              )}

              <div className="glass rounded-xl border border-white/[0.06] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-gray-500 text-xs uppercase tracking-wider">
                      <th className="px-4 py-3 w-10">
                        <input 
                          type="checkbox" 
                          checked={filteredUsers.length > 0 && selectedUsers.length === filteredUsers.length} 
                          onChange={() => toggleSelectAll('users')}
                          className="rounded border-white/[0.1] bg-white/[0.05] text-blue-500 focus:ring-offset-0 focus:ring-blue-500"
                        />
                      </th>
                      <th className="text-left px-4 py-3">Name</th>
                      <th className="text-left px-4 py-3 hidden sm:table-cell">Branch</th>
                      <th className="text-left px-4 py-3 hidden md:table-cell">Enrollment</th>
                      <th className="text-right px-4 py-3">
                        <button
                          onClick={() => setTokenSort(s => s === "desc" ? "asc" : "desc")}
                          className="flex items-center gap-1 ml-auto text-gray-500 hover:text-white transition-colors uppercase tracking-wider text-xs"
                        >
                          E-Tokens
                          <span className="text-[10px]">{tokenSort === "desc" ? "▼" : tokenSort === "asc" ? "▲" : "⇅"}</span>
                        </button>
                      </th>
                      <th className="text-right px-4 py-3 hidden sm:table-cell">Trades</th>
                      <th className="text-right px-4 py-3 hidden sm:table-cell">Options</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u, i) => (
                      <tr key={u.email} className={`border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.01]"} ${selectedUsers.includes(u.email) ? "bg-blue-500/5" : ""}`}>
                        <td className="px-4 py-3 text-center">
                          <input 
                            type="checkbox" 
                            checked={selectedUsers.includes(u.email)} 
                            onChange={() => toggleItemSelect(u.email, 'users')}
                            className="rounded border-white/[0.1] bg-white/[0.05] text-blue-500 focus:ring-offset-0 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white font-medium">{u.name}</p>
                          <p className="text-gray-600 text-xs">{u.email}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-400 hidden sm:table-cell">{u.branch}</td>
                        <td className="px-4 py-3 text-gray-400 font-mono text-xs hidden md:table-cell">{u.enrollment}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold tabular-nums ${u.eTokens >= 10000 ? "text-emerald-400" : u.eTokens >= 5000 ? "text-amber-400" : "text-red-400"}`}>
                            ₹{fmt(u.eTokens)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-400 hidden sm:table-cell">{u.tradeCount}</td>
                        <td className="px-4 py-3 text-right text-gray-400 hidden sm:table-cell">{u.optionTradeCount}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => setSelected(u)} className="text-xs text-blue-400 hover:text-blue-300 transition-colors px-2 py-1 rounded hover:bg-blue-500/10">
                            View →
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-600">No users found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
          </div>
        )}

        {/* Equity trades table */}
        {tab === "trades" && (
          <div className="space-y-4">
            
            {/* DIAGNOSTIC WARNING FOR MISSING SCHEMA */}
            {tradesError && (
               <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 mb-4 shadow-[0_0_25px_rgba(239,68,68,0.15)] flex flex-col md:flex-row gap-5 items-start">
                  <span className="text-4xl shadow-xl rounded-full p-1 bg-red-500/10">🚨</span>
                  <div>
                     <h3 className="text-white font-bold text-lg leading-tight mb-2">Database Disconnected / Missing</h3>
                     <p className="text-gray-300 text-sm leading-relaxed mb-4">
                        Your trading API requests are failing in the background because the PostgreSQL relation specifically for trades does not exist. <br/>
                        Supabase threw error code: <code className="bg-red-500/20 px-1.5 py-0.5 rounded text-red-200 font-bold ml-1">{tradesError}</code>
                     </p>
                     
                     <div className="bg-black/40 p-4 rounded-xl border border-red-500/10">
                        <h4 className="text-red-400 font-semibold mb-2 text-xs uppercase tracking-widest">How to solve this immediately:</h4>
                        <ol className="text-sm text-gray-400 space-y-2 list-decimal list-inside">
                           <li>Go to your <a href="https://supabase.com/dashboard" target="_blank" className="text-blue-400 underline">Supabase Dashboard</a> and open the <b>SQL Editor</b>.</li>
                           <li>Paste the exact contents of the <code>schema.sql</code> file located in your project directory.</li>
                           <li>Click <b>Run</b> to generate the tables.</li>
                           <li><i className="text-gray-500">(If already run, go to Project Settings -&gt; API -&gt; Reload Schema Cache)</i></li>
                        </ol>
                     </div>
                  </div>
               </div>
            )}

            <div className="glass rounded-xl border border-white/[0.06] overflow-hidden">
              {/* Bulk Actions Bar */}
              {selectedTrades.length > 0 && (
                <div className="flex items-center justify-between bg-blue-500/10 border-b border-blue-500/20 px-4 py-2 animate-in fade-in">
                  <span className="text-blue-300 text-xs font-medium">{selectedTrades.length} trades selected</span>
                  <button 
                    onClick={() => handleBulkDeleteTrades('equity')}
                    disabled={bulkDeleting}
                    className="px-3 py-1 bg-red-600/80 hover:bg-red-500 text-white text-[10px] font-bold rounded transition-colors flex items-center gap-1.5"
                  >
                    🗑️ Delete Selected
                  </button>
                </div>
              )}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-gray-500 text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 w-10">
                      <input 
                        type="checkbox" 
                        checked={filteredTrades.length > 0 && selectedTrades.length === filteredTrades.length} 
                        onChange={() => toggleSelectAll('trades')}
                        className="rounded border-white/[0.1] bg-white/[0.05] text-blue-500 focus:ring-offset-0 focus:ring-blue-500"
                      />
                    </th>
                    <th className="text-left px-4 py-3">User</th>
                    <th className="text-left px-4 py-3">Symbol</th>
                    <th className="text-left px-4 py-3">Action</th>
                    <th className="text-right px-4 py-3">Qty</th>
                    <th className="text-right px-4 py-3 hidden sm:table-cell">Price</th>
                    <th className="text-right px-4 py-3">Total</th>
                    <th className="text-right px-4 py-3 hidden md:table-cell">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.map((t, i) => (
                    <tr key={t._id} className={`border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.01]"} ${selectedTrades.includes(t._id) ? "bg-blue-500/5" : ""}`}>
                      <td className="px-4 py-3 text-center">
                        <input 
                          type="checkbox" 
                          checked={selectedTrades.includes(t._id)} 
                          onChange={() => toggleItemSelect(t._id, 'trades')}
                          className="rounded border-white/[0.1] bg-white/[0.05] text-blue-500 focus:ring-offset-0 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{t.email}</td>
                      <td className="px-4 py-3 text-white font-mono font-medium">{t.symbol?.replace("NSE:", "")}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.action === "buy" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                          {t.action.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300 tabular-nums">{t.amount}</td>
                      <td className="px-4 py-3 text-right text-gray-400 tabular-nums hidden sm:table-cell">₹{fmt(t.price)}</td>
                      <td className="px-4 py-3 text-right text-white font-semibold tabular-nums">₹{fmt(t.total)}</td>
                      <td className="px-4 py-3 text-right text-gray-600 text-xs hidden md:table-cell">{fmtDate(t.timestamp)}</td>
                    </tr>
                  ))}
                  {filteredTrades.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-600">No trades found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Option trades table */}
        {tab === "options" && (
          <div className="space-y-4">

            {/* DIAGNOSTIC WARNING */}
            {tradesError && (
               <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 mb-4 flex items-center gap-3 text-red-400">
                  <span>🚨</span> Database integration missing (<code>{tradesError}</code>) — Please execute `schema.sql` to track Options Trades!
               </div>
            )}

            <div className="glass rounded-xl border border-white/[0.06] overflow-hidden">
               {/* Bulk Actions Bar */}
               {selectedOptions.length > 0 && (
                <div className="flex items-center justify-between bg-blue-500/10 border-b border-blue-500/20 px-4 py-2 animate-in fade-in">
                  <span className="text-blue-300 text-xs font-medium">{selectedOptions.length} option trades selected</span>
                  <button 
                    onClick={() => handleBulkDeleteTrades('option')}
                    disabled={bulkDeleting}
                    className="px-3 py-1 bg-red-600/80 hover:bg-red-500 text-white text-[10px] font-bold rounded transition-colors flex items-center gap-1.5"
                  >
                    🗑️ Delete Selected
                  </button>
                </div>
              )}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-gray-500 text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 w-10">
                      <input 
                        type="checkbox" 
                        checked={filteredOpts.length > 0 && selectedOptions.length === filteredOpts.length} 
                        onChange={() => toggleSelectAll('options')}
                        className="rounded border-white/[0.1] bg-white/[0.05] text-blue-500 focus:ring-offset-0 focus:ring-blue-500"
                      />
                    </th>
                    <th className="text-left px-4 py-3">User</th>
                    <th className="text-left px-4 py-3">Contract</th>
                    <th className="text-left px-4 py-3">Action</th>
                    <th className="text-right px-4 py-3">Lots</th>
                    <th className="text-right px-4 py-3 hidden sm:table-cell">Premium</th>
                    <th className="text-right px-4 py-3">Total</th>
                    <th className="text-right px-4 py-3 hidden md:table-cell">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOpts.map((t, i) => (
                    <tr key={t._id} className={`border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.01]"} ${selectedOptions.includes(t._id) ? "bg-blue-500/5" : ""}`}>
                      <td className="px-4 py-3 text-center">
                        <input 
                          type="checkbox" 
                          checked={selectedOptions.includes(t._id)} 
                          onChange={() => toggleItemSelect(t._id, 'options')}
                          className="rounded border-white/[0.1] bg-white/[0.05] text-blue-500 focus:ring-offset-0 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{t.email}</td>
                      <td className="px-4 py-3 text-white font-mono text-xs truncate max-w-[160px]">{t.contractSymbol}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.action === "buy" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                          {t.action.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300 tabular-nums">{t.lots}</td>
                      <td className="px-4 py-3 text-right text-gray-400 tabular-nums hidden sm:table-cell">₹{fmt(t.premium)}</td>
                      <td className="px-4 py-3 text-right text-white font-semibold tabular-nums">₹{fmt(t.total)}</td>
                      <td className="px-4 py-3 text-right text-gray-600 text-xs hidden md:table-cell">{fmtDate(t.timestamp)}</td>
                    </tr>
                  ))}
                  {filteredOpts.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-600">No option trades found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Favorites tab */}
        {tab === "favorites" && <FavoritesManager />}

        {/* Recharge Requests tab */}
        {tab === "recharge" && (
          <div className="space-y-4">

            {/* Resolve toast */}
            {resolveMsg && (
              <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-xl border ${
                resolveMsg.ok ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-red-500/20 border-red-500/30 text-red-300'
              }`}>
                {resolveMsg.text}
              </div>
            )}

            {/* Admin password input */}
            <div className="glass rounded-xl border border-emerald-500/20 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-white font-bold text-sm flex items-center gap-2">💳 Recharge Requests</h3>
                  <p className="text-gray-500 text-xs mt-1">{pendingCount} pending · {rechargeRequests.length} total. Enter admin password to approve/reject.</p>
                </div>
                <input
                  type="password"
                  placeholder="Admin password to approve/reject"
                  value={resolvePassword}
                  onChange={e => setResolvePassword(e.target.value)}
                  className="input-field px-3 py-2 rounded-lg text-sm w-full sm:w-52"
                />
              </div>
            </div>

            {rechargeRequests.length === 0 ? (
              <div className="glass rounded-xl border border-white/[0.06] py-16 text-center">
                <p className="text-3xl mb-3">💳</p>
                <p className="text-gray-500 text-sm">No recharge requests yet.</p>
              </div>
            ) : (
              <div className="glass rounded-xl border border-white/[0.06] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-gray-500 text-xs uppercase tracking-wider">
                      <th className="text-left px-4 py-3">User</th>
                      <th className="text-right px-4 py-3">Amount (VT)</th>
                      <th className="text-left px-4 py-3 hidden md:table-cell">Description</th>
                      <th className="text-center px-4 py-3">Status</th>
                      <th className="text-right px-4 py-3 hidden sm:table-cell">Requested</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rechargeRequests.map((r, i) => (
                      <tr key={r.id} className={`border-b border-white/[0.04] ${
                        r.status === 'pending' ? 'bg-emerald-500/5' : i % 2 === 0 ? '' : 'bg-white/[0.01]'
                      }`}>
                        <td className="px-4 py-3">
                          <p className="text-white font-medium text-sm">{r.user_name || '—'}</p>
                          <p className="text-gray-500 text-xs">{r.user_email}</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-black text-emerald-400 tabular-nums">{r.requested_amount.toLocaleString()}</span>
                          <p className="text-gray-600 text-xs">≈ ₹{Math.ceil(r.requested_amount / 1000)}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell max-w-[200px] truncate">
                          {r.description || <span className="opacity-30">No description</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            r.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                            r.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600 text-xs hidden sm:table-cell">
                          {fmtDate(r.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          {r.status === 'pending' ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleResolve(r.id, 'approved')}
                                disabled={resolvingId === r.id}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[10px] font-bold rounded-lg transition-colors"
                              >
                                {resolvingId === r.id ? '...' : '✓ Approve'}
                              </button>
                              <button
                                onClick={() => handleResolve(r.id, 'rejected')}
                                disabled={resolvingId === r.id}
                                className="px-3 py-1.5 bg-red-600/70 hover:bg-red-500 disabled:opacity-50 text-white text-[10px] font-bold rounded-lg transition-colors"
                              >
                                ✕ Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-600 text-xs">{r.resolved_at ? fmtDate(r.resolved_at) : '—'}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// ── Entry ─────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("admin_authed") === "1") setAuthed(true);
  }, []);

  function handleLogin() {
    sessionStorage.setItem("admin_authed", "1");
    setAuthed(true);
  }

  function handleLogout() {
    sessionStorage.removeItem("admin_authed");
    setAuthed(false);
  }

  if (!authed) return <AdminLogin onLogin={handleLogin} />;
  return <AdminDashboard onLogout={handleLogout} />;
}
