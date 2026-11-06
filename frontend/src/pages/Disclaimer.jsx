import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, AlertTriangle } from "lucide-react";

export default function Disclaimer() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl px-6 py-14">
        <Link to="/" className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft size={14} /> Back to Meridian Bank
        </Link>

        <h1 className="font-display text-3xl">Disclaimer</h1>
        <p className="mt-2 text-sm text-muted">Last updated {new Date().toLocaleDateString()}</p>

        <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-400/40 bg-amber-100/40 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-700" />
          <p className="text-sm text-amber-800">
            Meridian Bank is <strong>not a real bank</strong>. It is a fictional demonstration
            application. Nothing on this site should be relied upon for actual banking, financial,
            legal, or investment decisions.
          </p>
        </div>

        <div className="prose-sm mt-8 space-y-5 text-sm leading-relaxed text-ink">
          <h2 className="font-display text-lg text-ink">No real financial services</h2>
          <p>
            This platform does not hold real deposits, is not insured by any deposit insurance
            scheme, does not move real money, and is not licensed or regulated as a bank, money
            transmitter, or financial institution in any jurisdiction. Account balances, transaction
            history, card numbers, interest rates, and product names shown throughout this site are
            entirely fictional and exist for demonstration purposes only.
          </p>

          <h2 className="font-display text-lg text-ink">No affiliation with any real institution</h2>
          <p>
            "Meridian Bank" is a fictional name chosen for this project. It is not affiliated with,
            endorsed by, or connected to any real bank, financial institution, or regulator, past or
            present. Any resemblance to a real institution's name, branding, or products is
            coincidental.
          </p>

          <h2 className="font-display text-lg text-ink">Security and compliance scope</h2>
          <p>
            This project demonstrates real engineering practices used in the financial industry —
            encryption at rest, hashed credentials, audit logging, transaction monitoring patterns,
            and a KYC-style review workflow. Demonstrating a pattern is not the same as being
            compliant with the regulations that pattern exists to satisfy. See <code>COMPLIANCE.md</code>{" "}
            in this project's source for a detailed, honest breakdown of what's implemented versus
            what real PCI-DSS/KYC/AML compliance actually requires (licensing, independent audits,
            regulator filings, and more that no amount of code alone provides).
          </p>

          <h2 className="font-display text-lg text-ink">Use at your own judgment</h2>
          <p>
            If you're using this software as a learning reference, portfolio piece, or internal demo,
            that's exactly what it's built for. It should not be deployed to handle real customer
            funds or real sensitive financial data without substantial additional work, legal review,
            and regulatory licensing appropriate to your jurisdiction.
          </p>
        </div>
      </div>
    </div>
  );
}
