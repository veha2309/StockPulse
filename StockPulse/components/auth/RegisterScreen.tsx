"use client";
import { useState } from "react";
import AuthCard from "./AuthCard";
import Field from "@/components/ui/Field";
import type { UserData } from "@/lib/types";

export default function RegisterScreen({ onRegister, onSwitch }: { onRegister: (user: UserData) => void; onSwitch: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", branch: "", enrollment: "" });
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const res  = await fetch("/api/auth", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "register", ...form }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error);
    onRegister({ ...data.user, options: data.user.options ?? [] });
  }

  return (
    <AuthCard icon="🚀" title="Create account" sub="Join StockPulse to track live markets">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <Field label="Full Name"      type="text"     placeholder="John Doe"       value={form.name}       onChange={set("name")}       required />
        <Field label="Email"          type="email"    placeholder="you@example.com" value={form.email}      onChange={set("email")}      required />
        <Field label="Password"       type="password" placeholder="Min. 8 characters" value={form.password} onChange={set("password")}   required />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Branch"        type="text" placeholder="CSE / ECE"    value={form.branch}      onChange={set("branch")}      required />
          <Field label="Enrollment No." type="text" placeholder="0101CS211001" value={form.enrollment}  onChange={set("enrollment")}  required />
        </div>
        {error && <p className="text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2 animate-fadeIn">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary mt-1 py-3 rounded-xl text-white font-semibold text-sm">
          {loading ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating...</span> : "Create Account"}
        </button>
      </form>
      <p className="text-center text-gray-600 text-xs mt-5">
        Have an account?{" "}
        <button onClick={onSwitch} className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">Sign in</button>
      </p>
    </AuthCard>
  );
}
