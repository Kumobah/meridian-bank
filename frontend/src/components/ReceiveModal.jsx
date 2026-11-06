import React, { useState } from "react";
import { X, Copy, Check } from "lucide-react";
import { formatAccountNumber } from "../lib/format.js";

export default function ReceiveModal({ accounts, onClose }) {
  const [copiedId, setCopiedId] = useState(null);

  const copy = (accountId) => {
    navigator.clipboard?.writeText(accountId);
    setCopiedId(accountId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-xl">Receive money</h2>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <p className="mb-4 text-sm text-muted">
          Share one of your account numbers with anyone on Meridian to receive a transfer.
        </p>

        <div className="space-y-3">
          {accounts.map((a) => (
            <div
              key={a.account_id}
              className="flex items-center justify-between rounded-xl border border-line px-4 py-3"
            >
              <div>
                <p className="text-xs uppercase tracking-wide text-muted capitalize">{a.account_type}</p>
                <p className="font-ledger text-base">{formatAccountNumber(a.account_id)}</p>
              </div>
              <button
                onClick={() => copy(a.account_id)}
                className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:bg-paper"
              >
                {copiedId === a.account_id ? (
                  <>
                    <Check size={13} className="text-emerald" /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={13} /> Copy
                  </>
                )}
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-lg bg-ink py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          Done
        </button>
      </div>
    </div>
  );
}
