"use client";
import { useState } from "react";
import AuthCard from "./AuthCard";
import Field from "@/components/ui/Field";
import type { UserData } from "@/lib/types";

export default function RegisterScreen({ onRegister, onSwitch }: { onRegister: (user: UserData) => void; onSwitch: () => void }) {
  const [step, setStep] = useState<"form" | "otp">("form");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [otp, setOtp] = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  // Send OTP
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) {
        return setError(data.error || "Failed to send verification code");
      }
      setStep("otp");
    } catch (err) {
      setLoading(false);
      setError("Failed to connect to authentication server.");
    }
  }

  // Resend OTP
  async function handleResendOtp() {
    setResending(true); setError("");
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });
      const data = await res.json();
      setResending(false);
      if (!res.ok) {
        return setError(data.error || "Failed to resend code");
      }
    } catch (err) {
      setResending(false);
      setError("Failed to connect to authentication server.");
    }
  }

  // Verify OTP & Register
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, otp }),
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) {
        return setError(data.error || "Verification failed");
      }
      onRegister({ ...data.user, options: data.user.options ?? [] });
    } catch (err) {
      setLoading(false);
      setError("Failed to connect to authentication server.");
    }
  }

  if (step === "otp") {
    return (
      <AuthCard icon="📧" title="Verify Email" sub={`We sent a 6-digit code to ${form.email}`}>
        <form onSubmit={handleVerifyOtp} className="flex flex-col gap-3.5">
          <Field 
            label="Verification Code" 
            type="text" 
            placeholder="123456" 
            value={otp} 
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} 
            required 
          />
          {error && <p className="text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2 animate-fadeIn">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary mt-1 py-3 rounded-xl text-white font-semibold text-sm">
            {loading ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Verifying...</span> : "Verify & Create Account"}
          </button>
        </form>
        <div className="flex justify-between items-center mt-5 text-xs text-gray-600">
          <button 
            type="button" 
            onClick={() => setStep("form")} 
            className="text-gray-400 hover:text-white transition-colors"
          >
            ← Back
          </button>
          <button 
            type="button" 
            disabled={resending} 
            onClick={handleResendOtp} 
            className="text-blue-400 hover:text-blue-300 font-semibold transition-colors disabled:opacity-55"
          >
            {resending ? "Sending..." : "Resend Code"}
          </button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard icon="🚀" title="Create account" sub="Join StockPulse to track live markets">
      <form onSubmit={handleSendOtp} className="flex flex-col gap-3.5">
        <Field label="Full Name"      type="text"     placeholder="John Doe"       value={form.name}       onChange={set("name")}       required />
        <Field label="Email"          type="email"    placeholder="you@example.com" value={form.email}      onChange={set("email")}      required />
        <Field label="Password"       type="password" placeholder="Min. 8 characters" value={form.password} onChange={set("password")}   required />
        {error && <p className="text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2 animate-fadeIn">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary mt-1 py-3 rounded-xl text-white font-semibold text-sm">
          {loading ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending code...</span> : "Continue"}
        </button>
      </form>
      <p className="text-center text-gray-600 text-xs mt-5">
        Have an account?{" "}
        <button onClick={onSwitch} className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">Sign in</button>
      </p>
    </AuthCard>
  );
}
