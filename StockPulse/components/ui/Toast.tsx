"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToastData } from "@/lib/types";

const TOAST_DURATION = 4000; // ms

export default function Toast({ toast, onDone }: { toast: ToastData; onDone: () => void }) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss after TOAST_DURATION
  useEffect(() => {
    timerRef.current = setTimeout(() => setVisible(false), TOAST_DURATION);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []); // Empty deps — only runs once per mount

  const isSuccess = toast.type === "success";

  return (
    <AnimatePresence onExitComplete={onDone}>
      {visible && (
        <motion.div
          key="toast"
          initial={{ opacity: 0, y: -16, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ type: "spring", damping: 24, stiffness: 300, mass: 0.5 }}
          className={cn(
            "fixed top-20 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-5 py-3.5 rounded-2xl border text-sm font-bold shadow-2xl min-w-[280px] max-w-[480px] pointer-events-auto",
            isSuccess
              ? "border-emerald-500/30 text-emerald-400 bg-[#0d1117] shadow-emerald-500/10"
              : "border-red-500/30 text-red-400 bg-[#0d1117] shadow-red-500/10"
          )}
        >
          <div className={cn("p-1 rounded-full flex-shrink-0", isSuccess ? "bg-emerald-500/20" : "bg-red-500/20")}>
            {isSuccess ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          </div>
          <span className="flex-1 leading-snug">{toast.message}</span>

          {/* Progress bar */}
          <motion.div
            className={cn(
              "absolute bottom-0 left-0 h-[2px] rounded-b-2xl",
              isSuccess ? "bg-emerald-500" : "bg-red-500"
            )}
            initial={{ width: "100%" }}
            animate={{ width: "0%" }}
            transition={{ duration: TOAST_DURATION / 1000, ease: "linear" }}
          />

          {/* Manual dismiss */}
          <button
            onClick={() => setVisible(false)}
            className="p-1 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
