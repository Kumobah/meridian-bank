import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl px-6 py-14">
        <Link to="/" className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft size={14} /> Back to Meridian Bank
        </Link>

        <h1 className="font-display text-3xl">Privacy statement</h1>
        <p className="mt-2 text-sm text-muted">Last updated {new Date().toLocaleDateString()}</p>

        <div className="prose-sm mt-8 space-y-5 text-sm leading-relaxed text-ink">
          <p>
            Meridian Bank is a <strong>fictional demonstration banking platform</strong> built for
            learning and portfolio purposes. It is not a real bank, is not licensed by any financial
            regulator, and does not process real payments, real deposits, or real customer data in
            the way a genuine financial institution would. This page describes, honestly, what this
            specific application actually does — not generic bank boilerplate.
          </p>

          <h2 className="font-display text-lg text-ink">What data this app collects</h2>
          <p>
            Account holder name, username, password, email, phone number, and — if you submit the
            identity-verification flow — a legal name, date of birth, address, ID type/number, and
            optionally the last 4 digits of a national ID/SSN. Transaction, card, and transfer-request
            records are also stored, all clearly fictional (demo amounts, demo counterparties).
          </p>

          <h2 className="font-display text-lg text-ink">How it's protected</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Passwords are hashed (PBKDF2), never stored or logged in plaintext.</li>
            <li>Email, phone number, full card numbers, and identity-verification documents are encrypted at rest.</li>
            <li>One-time codes are required on every login and are stored as a hash, not the raw code.</li>
            <li>Every login, transfer, and admin action is recorded in a tamper-evident audit log.</li>
          </ul>
          <p>
            The full technical breakdown — including what would still be missing for this to meet
            real regulatory standards — is documented in this project's <code>COMPLIANCE.md</code>{" "}
            file, part of its public source.
          </p>

          <h2 className="font-display text-lg text-ink">Who sees this data</h2>
          <p>
            Only accounts with the administrator role in this specific deployment can view other
            users' account information, and only for the purposes this demo simulates (approving
            transfers, reviewing identity verification, investigating flagged transactions). Nothing
            is shared with, sold to, or accessible by any third party — there are no third parties;
            this application doesn't call out to any external service other than, optionally, an SMS
            provider you configure yourself to deliver verification codes.
          </p>

          <h2 className="font-display text-lg text-ink">Your choices</h2>
          <p>
            Since this is demo software you or someone else is running locally, data lives in
            whatever database instance that deployment is pointed at. There's no persistent,
            centrally-operated "Meridian Bank" collecting data across installations — each
            deployment is its own isolated instance.
          </p>

          <h2 className="font-display text-lg text-ink">Questions</h2>
          <p>
            This is a software project, not a company. If you're evaluating this codebase and have
            questions about how a particular feature handles data, the answer is in the source —
            nothing here is hidden behind a real privacy program because there isn't one.
          </p>
        </div>
      </div>
    </div>
  );
}
