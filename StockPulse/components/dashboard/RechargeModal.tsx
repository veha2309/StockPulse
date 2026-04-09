"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wallet, Zap, CheckCircle, ArrowRight, Loader2, ChevronLeft, AlertTriangle, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userName?: string;
};

const spring = { type: "spring", damping: 28, stiffness: 180, mass: 0.6 } as const;

const AMOUNT_PRESETS = [10000, 25000, 50000, 100000];

export default function RechargeModal({ isOpen, onClose, userEmail, userName }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [amount, setAmount] = useState(10000);
  const [customAmount, setCustomAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [copied, setCopied] = useState(false);

  const finalAmount = customAmount ? parseInt(customAmount) || 0 : amount;
  const price = (finalAmount / 1000).toLocaleString();

  function handleClose() {
    onClose();
    setTimeout(() => { setStep(1); setError(""); setCustomAmount(""); setAmount(10000); setDescription(""); }, 300);
  }

  const SQL_SNIPPET = `CREATE TABLE IF NOT EXISTS public.recharge_requests (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email   text NOT NULL,
  user_name    text,
  requested_amount integer NOT NULL DEFAULT 10000,
  description  text,
  status       text DEFAULT 'pending',
  created_at   timestamptz DEFAULT now(),
  resolved_at  timestamptz,
  admin_note   text
);
NOTIFY pgrst, 'reload schema';`;

  // Check schema health whenever modal opens
  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/recharge').then(r => r.json()).then(d => {
      setSchemaMissing(!d.ready);
    }).catch(() => {});
  }, [isOpen]);

  function handleCopySQL() {
    navigator.clipboard.writeText(SQL_SNIPPET).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (finalAmount < 10000) { setError("Minimum request is 10,000 VT"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/recharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          name: userName,
          requestedAmount: finalAmount,
          description: description || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'SCHEMA_MISSING') {
          setSchemaMissing(true);
          setStep(1); // Go back to show the setup banner
          return;
        }
        setError(data.error || "Request failed");
        return;
      }
      setStep(3);
    } catch {
      setError("Network error, please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 24 }}
            transition={spring}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-background shadow-2xl shadow-black/40"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Gradient top */}
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/20 via-primary/5 to-transparent pointer-events-none" />
            <div className="absolute top-[-60px] right-[-60px] w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

            {/* Close */}
            <button
              onClick={handleClose}
              className="absolute right-5 top-5 z-10 rounded-full bg-secondary/80 p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
            >
              <X size={18} />
            </button>

            {/* Steps */}
            <div className="relative">
              <AnimatePresence mode="wait">
                {/* ── Step 1: Overview ── */}
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={spring}
                    className="p-8"
                  >
                    <div className="mb-6 mt-2 flex justify-center">
                      <div className="relative">
                        <div className="absolute inset-0 animate-pulse rounded-full bg-primary/20 blur-2xl" />
                        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-primary/30 bg-primary/10 text-primary shadow-xl">
                          <Zap size={36} className="fill-primary/30" />
                        </div>
                      </div>
                    </div>
                    <div className="text-center mb-6">
                      <h2 className="text-2xl font-black uppercase tracking-tight text-foreground mb-2">Token Recharge</h2>
                      <p className="text-sm text-muted-foreground">Request Virtual Tokens from the admin. Your request goes directly to the admin panel for review.</p>
                    </div>

                  {/* Schema missing banner */}
                    {schemaMissing && (
                      <div className="mb-5 rounded-2xl border border-amber-500/30 bg-amber-500/8 p-4">
                        <div className="flex items-start gap-3 mb-3">
                          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-black text-amber-500 uppercase tracking-wider mb-0.5">Admin Setup Required</p>
                            <p className="text-[10px] text-muted-foreground leading-relaxed">
                              Run this SQL in your <strong className="text-foreground">Supabase Dashboard → SQL Editor</strong> to enable recharge requests:
                            </p>
                          </div>
                        </div>
                        <div className="relative">
                          <pre className="text-[9px] font-mono text-amber-400/80 bg-black/30 rounded-xl p-3 overflow-x-auto leading-relaxed whitespace-pre-wrap">{SQL_SNIPPET}</pre>
                          <button
                            onClick={handleCopySQL}
                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-all"
                          >
                            {copied ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Rate card */}
                    <div className="mb-8 rounded-2xl border border-primary/20 bg-primary/5 p-5 relative overflow-hidden">
                      <div className="absolute top-[-20%] right-[-10%] w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
                      <div className="relative flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70 mb-1">Rate</p>
                          <p className="text-lg font-black text-foreground">1,000 VT = ₹1</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">Min Request</p>
                          <p className="text-lg font-black text-emerald-500">10,000 VT</p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setStep(2)}
                      className="flex w-full items-center justify-between rounded-2xl bg-primary px-6 py-4 text-xs font-black uppercase tracking-widest text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] hover:brightness-110 active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-3">
                        <Wallet size={18} />
                        <span>Submit Recharge Request</span>
                      </div>
                      <ArrowRight size={18} />
                    </button>
                    <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                      Reviewed & approved by admin
                    </p>
                  </motion.div>
                )}

                {/* ── Step 2: Form ── */}
                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={spring}
                    className="p-8"
                  >
                    <button
                      onClick={() => setStep(1)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-5 transition-colors"
                    >
                      <ChevronLeft size={14} /> Back
                    </button>

                    <h2 className="text-xl font-black uppercase tracking-tight text-foreground mb-1">Recharge Details</h2>
                    <p className="text-xs text-muted-foreground mb-6">Fill in the details and your request will appear in the admin panel.</p>

                    <form onSubmit={handleSubmit} className="space-y-5">
                      {/* Email (read-only) */}
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Your Email</label>
                        <div className="w-full rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm font-mono text-muted-foreground truncate">
                          {userEmail}
                        </div>
                      </div>

                      {/* Amount presets */}
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Amount (Virtual Tokens)</label>
                        <div className="grid grid-cols-4 gap-2 mb-2">
                          {AMOUNT_PRESETS.map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => { setAmount(p); setCustomAmount(""); }}
                              className={cn(
                                "py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                                !customAmount && amount === p
                                  ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                                  : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                              )}
                            >
                              {p >= 100000 ? `${p / 100000}L` : `${p / 1000}K`}
                            </button>
                          ))}
                        </div>
                        <input
                          type="number"
                          placeholder="Or enter custom amount…"
                          value={customAmount}
                          onChange={(e) => setCustomAmount(e.target.value)}
                          min={10000}
                          className="w-full bg-secondary/60 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                        />
                        {finalAmount >= 10000 && (
                          <p className="mt-1.5 text-[10px] text-muted-foreground font-medium">
                            Equivalent to <span className="text-primary font-black">₹{price}</span>
                          </p>
                        )}
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                          Reason / Description <span className="opacity-40">(optional)</span>
                        </label>
                        <textarea
                          rows={3}
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="e.g. Need more tokens to practice options strategies…"
                          className="w-full resize-none bg-secondary/60 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                        />
                      </div>

                      {error && (
                        <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-xs text-destructive font-medium">
                          {error}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={loading || finalAmount < 10000}
                        className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary px-6 py-4 text-xs font-black uppercase tracking-widest text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {loading ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <>Send Request <ArrowRight size={16} /></>
                        )}
                      </button>
                    </form>
                  </motion.div>
                )}

                {/* ── Step 3: Success ── */}
                {step === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={spring}
                    className="p-8 flex flex-col items-center text-center py-14"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", damping: 15, stiffness: 300, delay: 0.1 }}
                      className="relative mb-6"
                    >
                      <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-2xl animate-pulse" />
                      <div className="relative w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
                        <CheckCircle size={40} />
                      </div>
                    </motion.div>
                    <h2 className="text-2xl font-black text-foreground uppercase tracking-tight mb-2">Request Sent!</h2>
                    <p className="text-sm text-muted-foreground mb-2">Your request for <span className="text-primary font-black">{finalAmount.toLocaleString()} VT</span> has been sent to the admin panel.</p>
                    <p className="text-xs text-muted-foreground/60 mb-8">You'll receive your tokens once the admin approves your request.</p>
                    <button
                      onClick={handleClose}
                      className="px-8 py-3 rounded-2xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all active:scale-95"
                    >
                      Done
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Progress dots */}
            {step < 3 && (
              <div className="flex justify-center gap-1.5 pb-6">
                {[1, 2].map((s) => (
                  <div key={s} className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    step === s ? "w-6 bg-primary" : "w-1.5 bg-border"
                  )} />
                ))}
              </div>
            )}

            {/* Bottom accent */}
            <div className="h-1 bg-gradient-to-r from-primary/30 via-primary to-primary/30" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
