import React from "react";
import { formatAccountNumber } from "../lib/format.js";

export default function StatCard({ label, accountId, amount, type, frozen }) {
  return (
    <div className="rounded-2xl border border-line bg-white shadow-sm p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
          <p className="mt-1 font-ledger text-xs text-muted/80">{formatAccountNumber(accountId)}</p>
        </div>
        {frozen && (
          <span className="rounded-full bg-alert/10 px-2 py-0.5 text-[11px] font-medium text-alert">Frozen</span>
        )}
      </div>
      <p className="font-display text-3xl font-medium text-ink">
        ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
      <p className="mt-1 text-xs capitalize text-muted">{type} account</p>
    </div>
  );
}
