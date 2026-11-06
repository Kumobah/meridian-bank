import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck, Lock, Users, TrendingUp, Zap, Headphones, PiggyBank,
  LineChart, Wallet, ChevronDown, ArrowRight, CheckCircle2, ScrollText,
  Home, RefreshCw, Percent, Calculator,
} from "lucide-react";
import MegaNav from "../components/MegaNav.jsx";

export default function Landing() {
  return (
    <div id="top" className="bg-white text-ink">
      <MegaNav />
      <Hero />
      <TrustBar />
      <WhySection />
      <SecuritySection />
      <MobilePreview />
      <MortgageSection />
      <ProductsSection />
      <Testimonials />
      <FAQSection />
      <Footer />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-ink">
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

      <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 py-20 lg:grid-cols-2 lg:items-center lg:py-28">
        <div>
          <span className="inline-block rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/60">
            Demo banking platform — fictional data only
          </span>
          <h1 className="mt-5 font-display text-5xl font-medium leading-[1.08] text-white sm:text-6xl">
            Banking that moves with your life.
          </h1>
          <p className="mt-5 max-w-md text-white/60">
            Secure, simple, and intelligent digital banking designed for everyday people
            and growing businesses.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/signup"
              className="flex items-center gap-2 rounded-lg bg-emerald px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Open an Account <ArrowRight size={15} />
            </Link>
            <Link
              to="/login"
              className="rounded-lg border border-white/20 px-5 py-3 text-sm font-medium text-white hover:bg-white/5"
            >
              Login Securely
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap gap-x-8 gap-y-2 text-xs text-white/40">
            <span className="flex items-center gap-1.5"><Lock size={13} /> 256-bit encryption</span>
            <span className="flex items-center gap-1.5"><ShieldCheck size={13} /> 24/7 fraud monitoring</span>
            <span className="flex items-center gap-1.5"><Users size={13} /> Trusted by 50,000+ members</span>
          </div>
        </div>

        <div className="relative flex justify-center lg:justify-end">
          <div
            className="animate-fade-up w-72 rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm"
            style={{ animationDelay: "100ms" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-white/40">Meridian App</span>
              <Wallet size={14} className="text-white/40" />
            </div>
            <p className="mt-4 text-xs text-white/40">Total balance</p>
            <p className="font-display text-3xl text-white">$24,318.50</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-emerald">
              <TrendingUp size={12} /> +2.4% this month
            </p>
            <div className="mt-5 flex items-end gap-1.5">
              {[40, 65, 50, 80, 60, 90, 75].map((h, i) => (
                <div key={i} className="flex-1 rounded-t bg-emerald/40" style={{ height: `${h * 0.5}px` }} />
              ))}
            </div>
          </div>

          <div
            className="animate-fade-up absolute -bottom-6 -left-6 w-44 rounded-2xl bg-gradient-to-br from-ink-soft to-ink border border-white/10 px-4 py-3 shadow-2xl"
            style={{ animationDelay: "280ms" }}
          >
            <p className="text-[9px] uppercase tracking-widest text-white/40">Meridian Debit</p>
            <p className="mt-2 font-ledger text-xs tracking-[0.2em] text-white/90">•••• 4821</p>
            <p className="mt-2 text-[9px] text-white/40">Active · Contactless</p>
          </div>

          <div
            className="animate-fade-up absolute -right-4 -top-6 flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-ink shadow-xl"
            style={{ animationDelay: "420ms" }}
          >
            <CheckCircle2 size={13} className="text-emerald" /> Payment secured
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustBar() {
  return (
    <div className="border-y border-line bg-paper">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-6 py-4 text-xs text-muted sm:justify-between">
        <span className="flex items-center gap-2 font-medium text-ink">
          <ShieldCheck size={15} className="text-emerald" />
          MeridianShield Protection — demo coverage up to $250,000
          <span className="rounded-full bg-line px-2 py-0.5 text-[10px] font-normal text-muted">not real deposit insurance</span>
        </span>
        <span className="flex items-center gap-2"><Lock size={13} /> 256-bit encryption</span>
        <span className="flex items-center gap-2"><ScrollText size={13} /> Tamper-evident audit log</span>
        <span className="flex items-center gap-2"><Users size={13} /> 50,000+ demo members</span>
      </div>
    </div>
  );
}

const WHY_ITEMS = [
  { icon: Zap, title: "Instant transfers", blurb: "Move money between accounts in real time, no waiting for business days." },
  { icon: ShieldCheck, title: "Bank-grade security", blurb: "Encrypted data, hashed credentials, and a tamper-evident audit trail behind everything." },
  { icon: Headphones, title: "Real human support", blurb: "No bots when it matters — a real compliance team reviews every flag." },
  { icon: PiggyBank, title: "Transparent fees", blurb: "No surprise charges. What you see when you open an account is what you get." },
];

function WhySection() {
  return (
    <section id="why" className="mx-auto max-w-7xl px-6 py-20">
      <h2 className="font-display text-3xl">Why Meridian</h2>
      <p className="mt-2 max-w-lg text-muted">Built the way a bank should feel: fast, honest, and a little less stressful.</p>

      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {WHY_ITEMS.map(({ icon: Icon, title, blurb }) => (
          <div key={title} className="rounded-2xl border border-line p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-soft text-emerald-deep">
              <Icon size={18} />
            </div>
            <h3 className="mt-4 font-medium">{title}</h3>
            <p className="mt-1.5 text-sm text-muted">{blurb}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const SECURITY_ITEMS = [
  "Passwords hashed, never stored in plaintext",
  "PII encrypted at rest (email, phone, KYC documents)",
  "One-time codes required on every login",
  "Hash-chained, tamper-evident audit log",
  "Automatic flagging of large or structured transfers",
  "Role-based access control on every admin action",
];

function SecuritySection() {
  return (
    <section className="border-y border-line bg-paper">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 py-20 lg:grid-cols-2 lg:items-center">
        <div>
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-white">
            <ScrollText size={18} />
          </span>
          <h2 className="mt-5 font-display text-3xl">Security you can actually verify</h2>
          <p className="mt-3 max-w-md text-muted">
            Every login, transfer, and admin action is logged in a hash-chained audit trail —
            edit or delete a row out of band, and the chain breaks visibly.
          </p>
        </div>
        <ul className="space-y-3">
          {SECURITY_ITEMS.map((item) => (
            <li key={item} className="flex items-start gap-3 rounded-xl border border-line bg-white px-4 py-3">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald" />
              <span className="text-sm">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function MobilePreview() {
  return (
    <section id="mobile" className="mx-auto max-w-7xl px-6 py-20">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
        <div className="order-2 lg:order-1">
          <h2 className="font-display text-3xl">Your whole bank, in one screen.</h2>
          <p className="mt-3 max-w-md text-muted">
            Balances, transfers, cards, statements, and identity verification — all in a
            dashboard that doesn't make you dig for anything.
          </p>
          <Link to="/signup" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-emerald hover:underline">
            See it yourself <ArrowRight size={14} />
          </Link>
        </div>

        <div className="relative order-1 flex justify-center lg:order-2">
          <div className="w-full max-w-sm rounded-3xl border border-line bg-ink p-5 shadow-xl">
            <div className="flex items-center justify-between text-white/50">
              <span className="text-xs">Dashboard</span>
              <LineChart size={14} />
            </div>
            <p className="mt-4 text-xs text-white/40">Total balance</p>
            <p className="font-display text-2xl text-white">$24,318.50</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/[0.06] p-3">
                <p className="text-[10px] text-white/40">Checking</p>
                <p className="mt-1 font-ledger text-sm text-white">$4,318.50</p>
              </div>
              <div className="rounded-xl bg-white/[0.06] p-3">
                <p className="text-[10px] text-white/40">Savings</p>
                <p className="mt-1 font-ledger text-sm text-white">$20,000.00</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {["Grocery Co-op", "Rent transfer", "Freelance deposit"].map((label, i) => (
                <div key={label} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-white/70">
                  <span>{label}</span>
                  <span className={i === 2 ? "text-emerald" : "text-white/50"}>
                    {i === 2 ? "+$1,200.00" : "−$" + (i === 0 ? "84.20" : "1,450.00")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const MORTGAGE_PRODUCTS = [
  { icon: Home, title: "Fixed-rate mortgage", rate: "6.25% APR*", blurb: "One rate for the life of the loan — payments that don't move." },
  { icon: LineChart, title: "Adjustable-rate (5/1 ARM)", rate: "5.60% APR*", blurb: "Lower payments up front, adjusts annually after year five." },
  { icon: RefreshCw, title: "Refinance", rate: "From 5.85% APR*", blurb: "Lower your rate, shorten your term, or tap into equity." },
];

function MortgageSection() {
  return (
    <section id="mortgage" className="mx-auto max-w-7xl px-6 py-20">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl">Home loans, explained plainly</h2>
          <p className="mt-2 max-w-lg text-muted">Fictional demo rates — walk through options before you'd ever commit to anything.</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs text-muted">
          <Calculator size={13} /> Rates shown are illustrative, not live
        </span>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {MORTGAGE_PRODUCTS.map((p) => (
          <div key={p.title} className="rounded-2xl border border-line bg-white p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-soft text-emerald-deep">
              <p.icon size={18} />
            </div>
            <h3 className="mt-4 font-display text-lg">{p.title}</h3>
            <p className="mt-1 flex items-center gap-1 font-ledger text-sm text-emerald">
              <Percent size={12} /> {p.rate}
            </p>
            <p className="mt-2 text-sm text-muted">{p.blurb}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted">*Fictional rates for demo purposes. Not a real loan offer.</p>
    </section>
  );
}

const PRODUCTS = [
  { title: "Everyday Checking", rate: "$0 monthly fee", blurb: "No minimum balance, instant transfers, a debit card the day you open it.", features: ["No monthly fees", "Instant internal transfers", "Freeze/unfreeze card anytime"] },
  { title: "High-Yield Savings", rate: "4.10% APY*", blurb: "Put idle cash to work without locking it away.", features: ["No withdrawal penalties", "Compounds daily", "Auto-transfer rules"], featured: true },
  { title: "Investment (Preview)", rate: "Coming soon", blurb: "A brokerage account that lives next to your checking, not in a separate app.", features: ["Fractional shares", "Auto-invest round-ups", "Tax-loss harvesting"] },
];

function ProductsSection() {
  return (
    <section id="products" className="border-t border-line bg-paper">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="font-display text-3xl">Savings & investment accounts</h2>
        <p className="mt-2 max-w-lg text-muted">Demo products with fictional rates — no real funds, no real APY.</p>

        <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {PRODUCTS.map((p) => (
            <div
              key={p.title}
              className={`rounded-2xl border p-6 ${p.featured ? "border-emerald bg-white shadow-lg" : "border-line bg-white"}`}
            >
              {p.featured && (
                <span className="mb-3 inline-block rounded-full bg-emerald-soft px-2.5 py-1 text-[11px] font-medium text-emerald-deep">
                  Most popular
                </span>
              )}
              <h3 className="font-display text-xl">{p.title}</h3>
              <p className="mt-1 font-ledger text-sm text-muted">{p.rate}</p>
              <p className="mt-3 text-sm text-muted">{p.blurb}</p>
              <ul className="mt-4 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 size={14} className="text-emerald" /> {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/signup"
                className={`mt-6 block rounded-lg px-4 py-2.5 text-center text-sm font-medium ${
                  p.featured ? "bg-emerald text-white hover:opacity-90" : "border border-line hover:bg-paper"
                }`}
              >
                Get started
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted">*Fictional rate for demo purposes. Not a real financial product.</p>
      </div>
    </section>
  );
}

const TESTIMONIALS = [
  { initials: "JM", name: "J. Mensah", role: "Small business owner", quote: "Switching my day-to-day spending onto one dashboard instead of three apps genuinely changed my week." },
  { initials: "AB", name: "A. Boateng", role: "Freelance designer", quote: "The transfer confirmation flow is the first one that's ever made me feel like the bank was actually paying attention." },
  { initials: "MO", name: "M. Owusu", role: "Graduate student", quote: "Opened an account in under two minutes and could see exactly where my money was going from day one." },
];

function Testimonials() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20">
      <h2 className="font-display text-3xl">What members say</h2>
      <p className="mt-2 text-muted">Illustrative quotes from fictional demo users.</p>

      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <div key={t.name} className="rounded-2xl border border-line p-6">
            <p className="text-sm text-ink">&ldquo;{t.quote}&rdquo;</p>
            <div className="mt-5 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-xs font-medium text-white">
                {t.initials}
              </div>
              <div>
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-muted">{t.role}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const FAQS = [
  { q: "Is Meridian Bank a real bank?", a: "No. This is a demonstration banking platform built for learning and portfolio purposes. It doesn't connect to any real financial institution, hold real funds, or offer FDIC-insured deposits." },
  { q: "Is my data safe?", a: "Within the scope of a demo: passwords are hashed, PII is encrypted at rest, and every login requires a one-time code. See our security section above. It's not a substitute for a real bank's compliance program." },
  { q: "Can I use my real bank account with this?", a: "No — Meridian Bank doesn't link to real accounts, cards, or payment networks. All balances and transactions are fictional." },
  { q: "How do transfers work?", a: "Transfers move fictional balances between demo accounts on this platform, gated by a one-time code sent to the phone number on file (or printed to the server console in development)." },
  { q: "What happens to large transfers?", a: "Transfers at or above a demo threshold, or patterns that look like structuring, are automatically flagged for review — modeled on real anti-money-laundering practices, for illustration." },
];

function FAQSection() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section id="faq" className="border-t border-line bg-paper">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <h2 className="font-display text-3xl">Frequently asked questions</h2>

        <div className="mt-8 divide-y divide-line rounded-2xl border border-line bg-white shadow-sm">
          {FAQS.map((item, i) => {
            const open = openIndex === i;
            return (
              <div key={item.q}>
                <button
                  onClick={() => setOpenIndex(open ? -1 : i)}
                  className="flex w-full items-center justify-between px-6 py-4 text-left"
                >
                  <span className="text-sm font-medium">{item.q}</span>
                  <ChevronDown size={16} className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
                {open && <p className="px-6 pb-4 text-sm text-muted">{item.a}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const FOOTER_COLUMNS = [
  { title: "Personal", links: ["Checking", "Savings", "Cards", "Statements"] },
  { title: "Business", links: ["Business banking", "Payroll", "Merchant accounts"] },
  { title: "Company", links: ["About", "Careers", "Support"] },
  { title: "Legal", links: [
    { label: "Privacy Statement", to: "/privacy" },
    { label: "Disclaimer", to: "/disclaimer" },
    "Compliance notes",
  ] },
];

function Footer() {
  return (
    <footer className="border-t border-line bg-ink text-white/60">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-medium uppercase tracking-wide text-white/40">{col.title}</p>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) =>
                  typeof l === "string" ? (
                    <li key={l} className="text-sm hover:text-white">{l}</li>
                  ) : (
                    <li key={l.label}>
                      <Link to={l.to} className="text-sm hover:text-white hover:underline">{l.label}</Link>
                    </li>
                  )
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <p>© {new Date().getFullYear()} Meridian Bank. A fictional demo platform — not a real financial institution.</p>
            <div className="flex items-center gap-3">
              <Link to="/privacy" className="hover:text-white hover:underline">Privacy Statement</Link>
              <span className="text-white/20">·</span>
              <Link to="/disclaimer" className="hover:text-white hover:underline">Disclaimer</Link>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald text-[10px] font-semibold text-white">M</div>
            <span>Meridian</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
