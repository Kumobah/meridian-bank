import React, { useState } from "react";
import { User as UserIcon, Lock, CheckCircle2 } from "lucide-react";
import Layout from "../components/Layout.jsx";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function Settings() {
  const { user, refresh } = useAuth();
  const [profile, setProfile] = useState({ email: user?.email || "", phone_number: user?.phone_number || "" });
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [pw, setPw] = useState({ current_password: "", new_password: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const [pwSaved, setPwSaved] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileError("");
    setProfileSaved(false);
    setSavingProfile(true);
    try {
      await api.post("/api/settings/profile", profile);
      await refresh();
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (e) {
      setProfileError(e.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPwError("");
    setPwSaved(false);
    if (pw.new_password !== pw.confirm) {
      setPwError("New passwords don't match.");
      return;
    }
    setSavingPw(true);
    try {
      await api.post("/api/settings/change-password", {
        current_password: pw.current_password,
        new_password: pw.new_password,
      });
      setPw({ current_password: "", new_password: "", confirm: "" });
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 3000);
    } catch (e) {
      setPwError(e.message);
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <Layout>
      <h1 className="mb-2 font-display text-3xl">Settings</h1>
      <p className="mb-6 text-sm text-muted">Manage your profile and account security.</p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── Profile ──────────────────────────────────────────── */}
        <div className="rounded-2xl border border-line bg-white shadow-sm p-6">
          <div className="mb-4 flex items-center gap-2">
            <UserIcon size={16} className="text-muted" />
            <h2 className="font-display text-lg">Profile</h2>
          </div>

          <dl className="mb-5 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Full name</dt>
              <dd className="font-medium">{user?.full_name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Username</dt>
              <dd className="font-ledger">@{user?.username}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Role</dt>
              <dd className="capitalize">{user?.role}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Identity verification</dt>
              <dd className="capitalize">{user?.kyc_status}</dd>
            </div>
          </dl>

          <form onSubmit={saveProfile} className="space-y-4 border-t border-line pt-5">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Email</label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-emerald focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Phone number</label>
              <input
                value={profile.phone_number}
                onChange={(e) => setProfile({ ...profile, phone_number: e.target.value })}
                placeholder="+1…"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm font-mono focus:border-emerald focus:outline-none"
              />
              <p className="mt-1 text-xs text-muted">Used to deliver your login and transfer verification codes.</p>
            </div>

            {profileError && <p className="text-sm text-alert">{profileError}</p>}
            {profileSaved && (
              <p className="flex items-center gap-1.5 text-sm text-emerald">
                <CheckCircle2 size={14} /> Saved.
              </p>
            )}

            <button
              type="submit"
              disabled={savingProfile}
              className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {savingProfile ? "Saving…" : "Save profile"}
            </button>
          </form>
        </div>

        {/* ── Security ─────────────────────────────────────────── */}
        <div className="rounded-2xl border border-line bg-white shadow-sm p-6">
          <div className="mb-4 flex items-center gap-2">
            <Lock size={16} className="text-muted" />
            <h2 className="font-display text-lg">Password</h2>
          </div>

          <form onSubmit={savePassword} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Current password</label>
              <input
                type="password"
                required
                value={pw.current_password}
                onChange={(e) => setPw({ ...pw, current_password: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-emerald focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-muted">New password</label>
              <input
                type="password"
                required
                value={pw.new_password}
                onChange={(e) => setPw({ ...pw, new_password: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-emerald focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Confirm new password</label>
              <input
                type="password"
                required
                value={pw.confirm}
                onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-emerald focus:outline-none"
              />
            </div>

            {pwError && <p className="text-sm text-alert">{pwError}</p>}
            {pwSaved && (
              <p className="flex items-center gap-1.5 text-sm text-emerald">
                <CheckCircle2 size={14} /> Password updated.
              </p>
            )}

            <button
              type="submit"
              disabled={savingPw}
              className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {savingPw ? "Updating…" : "Update password"}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
