import React from "react";
import { ShieldCheck, Lock, Users, TrendingUp } from "lucide-react";

export default function AuthHero() {
  return (
    <div className="relative hidden w-[58%] overflow-hidden bg-ink lg:flex lg:flex-col lg:justify-between lg:p-14 xl:p-20">
      <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 animate-drift-a rounded-full bg-emerald/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-16 h-[28rem] w-[28rem] animate-drift-b rounded-full bg-amber-400/10 blur-3xl" />

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      <div className="relative z-10 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald font-display text-sm font-semibold text-white">
          M
        </div>
        <span className="font-display text-lg tracking-tight text-white">Meridian</span>
      </div>

      <div className="relative z-10">
        <h1 className="max-w-lg font-display text-5xl font-medium leading-[1.1] text-white">
          Banking that moves as fast as you do.
        </h1>
        <p className="mt-5 max-w-md text-white/55">
          Real-time balances, instant transfers, and a security team watching your
          account around the clock — all in one place.
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          <div
            className="animate-fade-up rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 backdrop-blur-sm"
            style={{ animationDelay: "150ms" }}
          >
            <p className="text-xs uppercase tracking-wide text-white/40">Total balance</p>
            <p className="mt-1 font-display text-2xl text-white">$24,318.50</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-emerald">
              <TrendingUp size={12} /> +2.4% this month
            </p>
          </div>

          <div
            className="animate-fade-up flex w-48 flex-col justify-between rounded-2xl bg-gradient-to-br from-ink-soft to-ink border border-white/10 px-5 py-4"
            style={{ animationDelay: "300ms" }}
          >
            <p className="text-[10px] uppercase tracking-widest text-white/40">Meridian Debit</p>
            <p className="mt-3 font-ledger text-sm tracking-[0.2em] text-white/90">•••• 4821</p>
            <p className="mt-3 text-[10px] text-white/40">Active · Expires 12/29</p>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex flex-wrap gap-x-8 gap-y-2 text-xs text-white/40">
        <span className="flex items-center gap-1.5">
          <Lock size={13} /> 256-bit encryption
        </span>
        <span className="flex items-center gap-1.5">
          <ShieldCheck size={13} /> 24/7 fraud monitoring
        </span>
        <span className="flex items-center gap-1.5">
          <Users size={13} /> Trusted by 50,000+ members
        </span>
      </div>
    </div>
  );
}
