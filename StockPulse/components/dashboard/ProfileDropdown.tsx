"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { User, LogOut, ChevronDown, Edit3, Shield, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserData } from "@/lib/types";

export default function ProfileDropdown({ user, onLogout, onEditOpen }: {
  user: UserData; onLogout: () => void; onEditOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        ref.current && !ref.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleOpen() {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    setOpen(o => !o);
  }

  const dropdown = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.97 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 99999 }}
          className="w-72 bg-background/95 backdrop-blur-xl rounded-[2rem] border border-border shadow-2xl"
        >
          <div className="px-8 py-8 border-b border-border bg-background/40 relative overflow-hidden rounded-t-[2rem]">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <User size={80} />
            </div>
            <div className="relative">
              <p className="text-sm font-black text-foreground uppercase tracking-tight truncate">{user.name}</p>
              <div className="flex items-center gap-2 mt-1 px-0.5">
                <Mail size={10} className="text-muted-foreground" />
                <p className="text-[9px] text-muted-foreground font-bold truncate opacity-60 tracking-wider lowercase">{user.email}</p>
              </div>
              <div className="flex items-center gap-2 mt-5">
                <span className="text-[9px] font-black text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20 tracking-widest uppercase">
                  {user.branch}
                </span>
                <div className="flex items-center gap-1.5 text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-40">
                  <Shield size={10} />
                  <span>{user.enrollment}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-background/20 rounded-b-[2rem]">
            <button
              onClick={() => { onEditOpen(); setOpen(false); }}
              className="w-full flex items-center gap-4 px-5 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-2xl transition-all group"
            >
              <div className="p-2 rounded-xl bg-secondary group-hover:bg-primary/10 transition-colors shadow-sm">
                <Edit3 size={14} className="group-hover:text-primary transition-colors text-muted-foreground" />
              </div>
              Manage Account
            </button>

            <div className="h-px bg-border my-2 mx-4 opacity-50" />

            <button
              onClick={onLogout}
              className="w-full flex items-center gap-4 px-5 py-4 text-[10px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/10 rounded-2xl transition-all group"
            >
              <div className="p-2 rounded-xl bg-destructive/10 group-hover:bg-destructive/20 transition-colors shadow-sm">
                <LogOut size={14} />
              </div>
              Terminate
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={cn(
          "flex items-center gap-2 glass-premium px-3 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-border active:scale-95",
          open ? "bg-primary text-primary-foreground border-primary/20 shadow-lg shadow-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
      >
        <div className={cn(
          "w-6 h-6 rounded-xl flex items-center justify-center font-black text-[10px] shadow-sm transition-all",
          open ? "bg-white text-primary" : "bg-primary text-white"
        )}>
          {user.name[0].toUpperCase()}
        </div>
        <span className="hidden sm:inline">{user.name.split(' ')[0]}</span>
        <ChevronDown size={12} className={cn("transition-transform duration-300", open && "rotate-180")} />
      </button>

      {mounted && createPortal(dropdown, document.body)}
    </div>
  );
}
