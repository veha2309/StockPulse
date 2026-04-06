"use client";
import { useEffect, useState } from "react";
import type { ToastData } from "@/lib/types";

export default function Toast({ toast, onDone }: { toast: ToastData; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const out  = setTimeout(() => setLeaving(true), 3500);
    const done = setTimeout(onDone, 3800);
    return () => { clearTimeout(out); clearTimeout(done); };
  }, [onDone]);

  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none ${leaving ? "animate-toastOut" : "animate-toastIn"}`}>
      <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl glass border text-sm font-medium shadow-2xl whitespace-nowrap ${
        toast.type === "success"
          ? "border-emerald-500/30 text-emerald-300 bg-emerald-500/10"
          : "border-red-500/30 text-red-300 bg-red-500/10"
      }`}>
        <span>{toast.type === "success" ? "✓" : "✕"}</span>
        {toast.message}
      </div>
    </div>
  );
}
