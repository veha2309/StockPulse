"use client";
import { useState } from "react";
import Field from "@/components/ui/Field";
import type { UserData } from "@/lib/types";

export default function EditProfileModal({ user, onUpdate, onClose }: {
  user: UserData; onUpdate: (u: UserData) => void; onClose: () => void;
}) {
  const [form, setForm] = useState({ name: user.name, branch: user.branch, enrollment: user.enrollment, currentPassword: "", newPassword: "" });
  const [error, setError]   = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    const res  = await fetch("/api/auth", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", email: user.email, ...form }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setError(data.error);
    onUpdate(data.user);
    onClose();
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeIn" style={{ zIndex: 9999 }} onClick={onClose}>
      <div className="glass rounded-2xl p-6 w-full max-w-sm mx-4 overflow-y-auto animate-fadeInUp" style={{ maxHeight: "90vh" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-white">Edit Profile</h3>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300 text-lg leading-none transition-colors">✕</button>
        </div>
        <form onSubmit={handleSave} className="flex flex-col gap-3.5">
          <Field label="Full Name"  type="text"     value={form.name}            onChange={set("name")}            required />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Branch"     type="text"   value={form.branch}          onChange={set("branch")}          required />
            <Field label="Enrollment" type="text"   value={form.enrollment}      onChange={set("enrollment")}      required />
          </div>
          <div className="h-px bg-white/[0.06] my-1" />
          <Field label="Current Password" type="password" placeholder="Required to save" value={form.currentPassword} onChange={set("currentPassword")} required />
          <Field label="New Password"     type="password" placeholder="Leave blank to keep" value={form.newPassword}  onChange={set("newPassword")} />
          {error && <p className="text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-xs text-gray-400 hover:text-white glass transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 btn-primary py-2.5 rounded-xl text-xs text-white font-semibold">
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
