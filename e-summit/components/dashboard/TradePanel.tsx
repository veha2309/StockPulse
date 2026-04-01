"use client";
import { useState, useEffect } from "react";
import Toast from "@/components/ui/Toast";
import type { UserData, ToastData, Company } from "@/lib/types";

type Props = {
  user: UserData;
  company: Company;
  price: number | null;
  onTradeSuccess: (user: UserData) => void;
};

export default function TradePanel({ user, company, price, onTradeSuccess }: Props) {
  const [amount, setAmount] = useState("");
  const [action, setAction] = useState<"buy" | "sell">("buy");
  const [loading, setLoading] = useState(false);
  const [toast, setToast]   = useState<ToastData | null>(null);

  const cost      = price && amount ? price * +amount : 0;
  const canAfford = user.eTokens >= cost;
  const hasAsset  = (user.portfolio ?? []).find(p => p.symbol === company.symbol);
  const canSell   = hasAsset && hasAsset.amount >= +amount;
  const disabled  = loading || !amount || +amount <= 0 || (action === "buy" && !canAfford) || (action === "sell" && !canSell);

  async function handleTrade(e: React.FormEvent) {
    e.preventDefault();
    if (!price || !amount || +amount <= 0) { setToast({ message: "Please enter a valid amount.", type: "error" }); return; }
    setLoading(true);
    const res  = await fetch("/api/trade", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, action, symbol: company.symbol, amount: +amount, price }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setToast({ message: data.error, type: "error" });
    } else {
      onTradeSuccess(data.user);
      setToast({ message: `${action === "buy" ? "Bought" : "Sold"} ${amount} share${+amount > 1 ? "s" : ""} of ${company.name}`, type: "success" });
      setAmount("");
    }
  }

  useEffect(() => { setAmount(""); setToast(null); }, [company]);

  return (
    <>
      {toast && <Toast key={toast.message + Date.now()} toast={toast} onDone={() => setToast(null)} />}
      <div className="px-3 sm:px-6 pb-4 flex-shrink-0 border-t border-white/[0.06] pt-4 bg-black/20">
        <form onSubmit={handleTrade}>
          <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end">
            <div>
              <label className="text-[10px] font-semibold tracking-widest text-gray-500 uppercase">Action</label>
              <div className="flex mt-1.5 bg-black/30 p-1 rounded-xl border border-white/[0.06]">
                <button type="button" onClick={() => setAction("buy")}  className={`flex-1 text-xs font-semibold rounded-lg py-2 transition-colors ${action === "buy"  ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}>Buy</button>
                <button type="button" onClick={() => setAction("sell")} className={`flex-1 text-xs font-semibold rounded-lg py-2 transition-colors ${action === "sell" ? "bg-red-600 text-white"  : "text-gray-400 hover:text-white"}`}>Sell</button>
              </div>
            </div>
            <div>
              <label htmlFor="trade-amount" className="text-[10px] font-semibold tracking-widest text-gray-500 uppercase">Shares</label>
              <input id="trade-amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" min="0"
                className="input-field w-full px-3 py-3 rounded-xl text-white text-sm placeholder-gray-700 mt-1.5" />
            </div>
            <div className="flex flex-col">
              <div className="flex justify-between text-[11px] text-gray-500 mb-1.5">
                <span className="hidden sm:inline">Total:</span>
                <span className="font-mono text-gray-400">₹{cost.toFixed(2)}</span>
              </div>
              <button type="submit" disabled={disabled}
                className="btn-primary py-3 rounded-xl text-white font-semibold text-xs sm:text-sm disabled:bg-gray-700 disabled:cursor-not-allowed">
                {loading ? "..." : `${action === "buy" ? "Buy" : "Sell"}`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
