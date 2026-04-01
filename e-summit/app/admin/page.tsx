"use client";
import { useState, useEffect, useCallback } from "react";

const API = "http://localhost:4000/api/admin";

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

type Tab = "users" | "trades" | "options";

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

// ── Main dashboard ────────────────────────────────────────────────────────────
function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab]           = useState<Tab>("users");
  const [stats, setStats]       = useState<Stats | null>(null);
  const [users, setUsers]       = useState<AdminUser[]>([]);
  const [trades, setTrades]     = useState<Trade[]>([]);
  const [optTrades, setOptTrades] = useState<OptionTrade[]>([]);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [search, setSearch]     = useState("");

  const load = useCallback(async () => {
    const [sRes, uRes, tRes] = await Promise.all([
      fetch(`${API}/stats`),
      fetch(`${API}/users`),
      fetch(`${API}/trades`),
    ]);
    setStats(await sRes.json());
    setUsers(await uRes.json());
    const td = await tRes.json();
    setTrades(td.trades);
    setOptTrades(td.optionTrades);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleReset(email: string, amount: number) {
    await fetch(`${API}/user/reset-tokens`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, amount }) });
    load();
  }

  async function handleDelete(email: string) {
    await fetch(`${API}/user`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    load();
  }

  const filteredUsers  = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));
  const filteredTrades = trades.filter(t => t.email.toLowerCase().includes(search.toLowerCase()) || t.symbol?.toLowerCase().includes(search.toLowerCase()));
  const filteredOpts   = optTrades.filter(t => t.email.toLowerCase().includes(search.toLowerCase()) || t.contractSymbol?.toLowerCase().includes(search.toLowerCase()));

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
            {(["users", "trades", "options"] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors capitalize ${tab === t ? "border-blue-500 text-white" : "border-transparent text-gray-500 hover:text-gray-300"}`}>
                {t === "options" ? "Option Trades" : t}
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
          <div className="glass rounded-xl border border-white/[0.06] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-gray-500 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Branch</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Enrollment</th>
                  <th className="text-right px-4 py-3">E-Tokens</th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell">Trades</th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell">Options</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u, i) => (
                  <tr key={u.email} className={`border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
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
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-600">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Equity trades table */}
        {tab === "trades" && (
          <div className="glass rounded-xl border border-white/[0.06] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-gray-500 text-xs uppercase tracking-wider">
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
                  <tr key={t._id} className={`border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
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
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-600">No trades found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Option trades table */}
        {tab === "options" && (
          <div className="glass rounded-xl border border-white/[0.06] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-gray-500 text-xs uppercase tracking-wider">
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
                  <tr key={t._id} className={`border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
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
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-600">No option trades found</td></tr>
                )}
              </tbody>
            </table>
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
