"use client";
import { useState } from "react";
import AuthCard from "./AuthCard";
import Field from "@/components/ui/Field";
import type { UserData } from "@/lib/types";

export default function LoginScreen({ onLogin, onSwitch }: { onLogin: (user: UserData) => void; onSwitch: () => void }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const res  = await fetch("/api/auth", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error);
    onLogin({ ...data.user, options: data.user.options ?? [] });
  }

  return (
    <AuthCard icon="📈" title="Welcome back" sub="Sign in to your StockPulse account">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Email"    type="email"    placeholder="you@example.com" value={email}    onChange={e => setEmail(e.target.value)}    required />
        <Field label="Password" type="password" placeholder="••••••••"        value={password} onChange={e => setPassword(e.target.value)} required />
        {error && <p className="text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2 animate-fadeIn">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary mt-1 py-3 rounded-xl text-white font-semibold text-sm">
          {loading ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in...</span> : "Sign In"}
        </button>
      </form>
      <p className="text-center text-gray-600 text-xs mt-5">
        No account?{" "}
        <button onClick={onSwitch} className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">Create one</button>
      </p>
    </AuthCard>
  );
}
