"use client";
import { useState, useEffect, useRef } from "react";
import type { UserData } from "@/lib/types";

export default function ProfileDropdown({ user, onLogout, onEditOpen }: {
  user: UserData; onLogout: () => void; onEditOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 glass px-3 py-1.5 rounded-full text-xs text-gray-300 hover:text-white transition-colors">
        <span className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-[10px]">
          {user.name[0].toUpperCase()}
        </span>
        <span className="hidden sm:inline">{user.name}</span>
        <span className="text-gray-600">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 glass rounded-xl border border-white/[0.08] overflow-hidden z-50 animate-fadeIn">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <p className="text-xs font-semibold text-white truncate">{user.name}</p>
            <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">{user.branch} · {user.enrollment}</p>
          </div>
          <button onClick={() => { onEditOpen(); setOpen(false); }}
            className="w-full text-left px-4 py-2.5 text-xs text-gray-400 hover:text-white hover:bg-white/[0.04] transition-colors">
            ✏️ Edit Profile
          </button>
          <button onClick={onLogout}
            className="w-full text-left px-4 py-2.5 text-xs text-red-400 hover:text-red-300 hover:bg-white/[0.04] transition-colors border-t border-white/[0.06]">
            ↩ Sign out
          </button>
        </div>
      )}
    </div>
  );
}
