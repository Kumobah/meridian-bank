import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, ArrowLeftRight, CreditCard, FileText, ShieldCheck, BadgeCheck, Settings, LogOut, ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/cards", label: "Cards", icon: CreditCard },
  { to: "/statements", label: "Statements", icon: FileText },
  { to: "/kyc", label: "Identity verification", icon: BadgeCheck },
];

function initials(name) {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      <aside className="hidden h-full w-64 shrink-0 flex-col justify-between overflow-y-auto bg-ink px-5 py-6 text-white md:flex">
        <div>
          <div className="mb-10 flex items-center gap-2 px-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald text-sm font-display font-semibold">
              M
            </div>
            <span className="font-display text-lg tracking-tight">Meridian</span>
          </div>

          <nav className="space-y-0.5">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "border-emerald bg-white/[0.07] text-white"
                      : "border-transparent text-white/55 hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                <Icon size={17} strokeWidth={1.8} className="shrink-0" />
                <span className="flex-1">{label}</span>
                {to === "/kyc" && user?.kyc_status && user.kyc_status !== "verified" && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                )}
              </NavLink>
            ))}

            {user?.role === "admin" && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "border-emerald bg-emerald/15 text-emerald"
                      : "border-transparent text-white/55 hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                <ShieldCheck size={17} strokeWidth={1.8} className="shrink-0" />
                Admin panel
              </NavLink>
            )}

            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "border-emerald bg-white/[0.07] text-white"
                    : "border-transparent text-white/55 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <Settings size={17} strokeWidth={1.8} className="shrink-0" />
              Settings
            </NavLink>
          </nav>
        </div>

        <div className="border-t border-white/10 pt-4">
          <NavLink
            to="/settings"
            className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/5"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald text-xs font-semibold">
              {initials(user?.full_name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.full_name}</p>
              <p className="truncate text-xs text-white/40">@{user?.username}</p>
            </div>
            <ChevronRight size={14} className="shrink-0 text-white/30 group-hover:text-white/60" />
          </NavLink>
          <button
            onClick={handleLogout}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/55 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut size={16} strokeWidth={1.8} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex h-full flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between border-b border-line bg-paper/80 px-6 py-4 backdrop-blur md:hidden">
          <span className="font-display text-lg">Meridian</span>
          <button onClick={handleLogout} className="text-sm text-muted">
            Sign out
          </button>
        </header>
        <main className="scrollbar-thin flex-1 overflow-y-auto px-6 py-8 md:px-10 md:py-10">{children}</main>
      </div>
    </div>
  );
}
