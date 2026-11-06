import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthHero from "../components/AuthHero.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { requestLogin } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await requestLogin(username, password);
      if (data.otp_debug) {
        console.info(`[dev] OTP code: ${data.otp_debug}`);
      }
      navigate("/verify-otp", {
        state: {
          otpToken: data.otp_token,
          maskedPhone: data.masked_phone,
          expiresIn: data.expires_in_seconds,
        },
      });
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
            <h2 className="font-display text-2xl text-ink">Welcome back</h2>
            <p className="mt-1 text-sm text-muted">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-line bg-white shadow-sm p-6">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                required
                className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-emerald focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-emerald focus:outline-none"
              />
            </div>

            {error && <p className="text-sm text-alert">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-emerald py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Sending code…" : "Continue"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-muted">
            New to Meridian?{" "}
            <Link to="/signup" className="font-medium text-emerald hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
