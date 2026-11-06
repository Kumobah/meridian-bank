import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronDown, Menu, X, Wallet, CreditCard, Smartphone, Landmark,
  Briefcase, Users2, Home, RefreshCw, PiggyBank, LineChart, ShieldCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

const MEGA_MENU = {
  Personal: {
    blurb: "Everyday banking built around your life, not the branch's hours.",
    columns: [
      {
        heading: "Accounts",
        items: [
          { label: "Checking", desc: "No minimum balance, no monthly fee", icon: Wallet, to: "/signup" },
          { label: "Savings", desc: "Compounds daily, no lock-in", icon: PiggyBank, to: "/signup" },
        ],
      },
      {
        heading: "Cards & access",
        items: [
          { label: "Debit cards", desc: "Virtual + physical, freeze anytime", icon: CreditCard, to: "/signup" },
          { label: "Mobile banking", desc: "Your whole bank in one screen", icon: Smartphone, to: "/signup" },
        ],
      },
    ],
  },
  Business: {
    blurb: "Banking that scales with a growing business, not against it.",
    columns: [
      {
        heading: "For your business",
        items: [
          { label: "Business checking", desc: "Built for daily operations", icon: Briefcase, to: "/signup" },
          { label: "Team accounts", desc: "Role-based access for staff", icon: Users2, to: "/signup" },
        ],
      },
    ],
  },
  Mortgage: {
    blurb: "Home financing, explained plainly before you commit to anything.",
    columns: [
      {
        heading: "Home loans",
        items: [
          { label: "Fixed-rate mortgage", desc: "Predictable payments, full term", icon: Home, to: "/#mortgage" },
          { label: "Adjustable-rate", desc: "Lower start, adjusts with market", icon: LineChart, to: "/#mortgage" },
          { label: "Refinance", desc: "Lower your rate or tap equity", icon: RefreshCw, to: "/#mortgage" },
        ],
      },
    ],
  },
  Wealth: {
    blurb: "Planning tools for the money you're not spending today.",
    columns: [
      {
        heading: "Grow it",
        items: [
          { label: "Investing", desc: "Fractional shares, auto-invest", icon: LineChart, to: "/#products" },
          { label: "Retirement", desc: "Tax-advantaged planning tools", icon: Landmark, to: "/#products" },
        ],
      },
    ],
  },
};

export default function MegaNav() {
  const [openMenu, setOpenMenu] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setOpenMenu(null);
        setLoginOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header ref={navRef} className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald font-display text-sm font-semibold text-white">
            M
          </div>
          <span className="font-display text-lg tracking-tight">Meridian</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {Object.entries(MEGA_MENU).map(([label, menu]) => (
            <div key={label} className="relative">
              <button
                onClick={() => { setOpenMenu(openMenu === label ? null : label); setLoginOpen(false); }}
                className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm transition-colors ${
                  openMenu === label ? "bg-paper text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {label}
                <ChevronDown size={14} className={`transition-transform ${openMenu === label ? "rotate-180" : ""}`} />
              </button>

              {openMenu === label && (
                <div className="absolute left-1/2 top-full mt-2 w-[420px] -translate-x-1/2 rounded-2xl border border-line bg-white p-5 shadow-xl">
                  <p className="mb-4 text-xs text-muted">{menu.blurb}</p>
                  <div className={`grid gap-6 ${menu.columns.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                    {menu.columns.map((col) => (
                      <div key={col.heading}>
                        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">{col.heading}</p>
                        <div className="space-y-1">
                          {col.items.map((item) => (
                            <Link
                              key={item.label}
                              to={item.to}
                              onClick={() => setOpenMenu(null)}
                              className="flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-paper"
                            >
                              <item.icon size={16} className="mt-0.5 shrink-0 text-emerald" />
                              <span>
                                <span className="block text-sm font-medium text-ink">{item.label}</span>
                                <span className="block text-xs text-muted">{item.desc}</span>
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="relative hidden sm:block">
            <button
              onClick={() => { setLoginOpen(!loginOpen); setOpenMenu(null); }}
              className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                loginOpen ? "bg-paper text-ink" : "text-ink hover:text-emerald"
              }`}
            >
              Log in <ChevronDown size={14} className={`transition-transform ${loginOpen ? "rotate-180" : ""}`} />
            </button>
            {loginOpen && <QuickLogin onDone={() => setLoginOpen(false)} />}
          </div>

          <Link
            to="/signup"
            className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Open Account
          </Link>

          <button onClick={() => setMobileOpen(!mobileOpen)} className="text-ink lg:hidden">
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-line bg-white px-6 py-4 lg:hidden">
          <div className="space-y-1">
            {Object.keys(MEGA_MENU).map((label) => (
              <p key={label} className="rounded-lg px-3 py-2 text-sm font-medium text-ink">{label}</p>
            ))}
          </div>
          <div className="mt-3 flex gap-2 border-t border-line pt-3">
            <Link to="/login" className="flex-1 rounded-lg border border-line py-2 text-center text-sm font-medium">Log in</Link>
            <Link to="/signup" className="flex-1 rounded-lg bg-ink py-2 text-center text-sm font-medium text-white">Open Account</Link>
          </div>
        </div>
      )}
    </header>
  );
}

function QuickLogin({ onDone }) {
  const { requestLogin } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await requestLogin(username, password);
      onDone();
      navigate("/verify-otp", {
        state: { otpToken: data.otp_token, maskedPhone: data.masked_phone, expiresIn: data.expires_in_seconds },
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-line bg-white p-5 shadow-xl">
      <p className="mb-3 flex items-center gap-1.5 text-xs text-muted">
        <ShieldCheck size={13} /> Quick sign-in — you'll still verify with a one-time code
      </p>
      <form onSubmit={submit} className="space-y-3">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          autoFocus
          required
          className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-emerald focus:outline-none"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-emerald focus:outline-none"
        />
        {error && <p className="text-xs text-alert">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-emerald py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Checking…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
