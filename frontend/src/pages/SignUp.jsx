import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthHero from "../components/AuthHero.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function SignUp() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "", username: "", email: "", phone_number: "", password: "", confirm: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setBusy(true);
    try {
      const { confirm, ...payload } = form;
      await register(payload);
      navigate("/dashboard");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
      <AuthHero />

      <div className="flex flex-1 items-center justify-center overflow-y-auto bg-paper px-6 py-10 lg:bg-white">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-emerald font-display text-lg text-white">
              M
            </div>
            <h1 className="font-display text-2xl text-ink">Meridian Bank</h1>
          </div>

          <div className="mb-6 hidden lg:block">
            <h2 className="font-display text-2xl text-ink">Create your account</h2>
            <p className="mt-1 text-sm text-muted">Opens a checking account instantly — no paperwork.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-line bg-white shadow-sm p-6">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Full name</label>
              <input
                required
                value={form.full_name}
                onChange={update("full_name")}
                autoFocus
                className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-emerald focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Username</label>
              <input
                required
                value={form.username}
                onChange={update("username")}
                placeholder="letters, numbers, . or _"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm font-mono focus:border-emerald focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={update("email")}
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-emerald focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Phone</label>
                <input
                  value={form.phone_number}
                  onChange={update("phone_number")}
                  placeholder="+1…"
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm font-mono focus:border-emerald focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Password</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={update("password")}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-emerald focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Confirm password</label>
              <input
                type="password"
                required
                value={form.confirm}
                onChange={update("confirm")}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-emerald focus:outline-none"
              />
            </div>

            {error && <p className="text-sm text-alert">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-emerald py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Creating account…" : "Create account"}
            </button>

            <p className="pt-1 text-center text-xs text-muted">
              A phone number is needed later for transfer verification codes — you can add one anytime.
            </p>
          </form>

          <p className="mt-5 text-center text-sm text-muted">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-emerald hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
