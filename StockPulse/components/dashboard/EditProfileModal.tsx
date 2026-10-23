"use client";
import { postJSON } from "@/lib/http";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Shield,
  Key,
  X,
  Save,
  Fingerprint,
  Activity,
} from "lucide-react";
import Field from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import type { UserData } from "@/lib/types";

export default function EditProfileModal({
  user,
  onUpdate,
  onClose,
}: {
  user: UserData;
  onUpdate: (u: UserData) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: user.name,
    currentPassword: "",
    newPassword: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const data = await postJSON<{ user: UserData }>("/api/auth", {
        action: "update",
        email: user.email,
        ...form,
      });
      onUpdate(data.user);
      onClose();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to save profile",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-md z-[9999] px-4 py-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 30, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="surface rounded-xl rounded-xl p-6 sm:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar border-border shadow-none relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
          <Fingerprint size={120} />
        </div>

        <button
          aria-label="Close panel"
          onClick={onClose}
          className="absolute top-6 right-6 sm:top-8 sm:right-8 text-muted-foreground hover:text-foreground transition-all hover:rotate-90 z-10"
        >
          <X size={24} />
        </button>

        <div className="mb-8 sm:mb-10 mt-2 sm:mt-0">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="hidden xs:flex p-3 sm:p-4 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-none shadow-primary/5">
              <User size={28} />
            </div>
            <div>
              <h3 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-normal normal-case">
                Your profile
              </h3>
              <p className="text-[10px] text-muted-foreground font-semibold normal-case tracking-normal mt-2 opacity-80">
                Manage your account details
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-8">
          <div className="grid grid-cols-1 gap-6">
            <div>
              <Field
                label="Full Name"
                type="text"
                value={form.name}
                onChange={set("name")}
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-4 py-2">
            <div className="h-px flex-1 bg-border/50" />
            <div className="flex items-center gap-2">
              <Shield size={12} className="text-primary" />
              <span className="text-[9px] font-semibold text-muted-foreground normal-case tracking-normal opacity-60">
                Authentication Layer
              </span>
            </div>
            <div className="h-px flex-1 bg-border/50" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Field
              label="Current Password"
              type="password"
              placeholder="Required to save"
              value={form.currentPassword}
              onChange={set("currentPassword")}
              required
            />
            <Field
              label="New Password"
              type="password"
              placeholder="Optional"
              value={form.newPassword}
              onChange={set("newPassword")}
            />
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.p
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="text-destructive text-[10px] font-semibold normal-case tracking-normal bg-destructive/10 rounded-xl px-6 py-4 border border-destructive/20 text-center"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-8 py-4 rounded-xl text-[10px] font-semibold normal-case tracking-normal text-muted-foreground hover:text-foreground bg-secondary/80 border border-border transition-all active:scale-95"
            >
              Abort
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-3 px-8 py-4 rounded-xl text-[10px] font-semibold normal-case tracking-normal text-primary-foreground bg-primary shadow-none shadow-primary/30  active:scale-95 transition-all disabled:opacity-80"
            >
              {saving ? (
                <span className="w-5 h-5 border-[3px] border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Activity size={16} />
                  Update Identity
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
