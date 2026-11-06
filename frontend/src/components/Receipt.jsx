import React from "react";
import { CheckCircle2, Clock, Download, Printer, X } from "lucide-react";
import { formatAccountNumber } from "../lib/format.js";

export default function Receipt({ receipt, onClose }) {
  const {
    reference, amount, fee, from_account, to_account, description, timestamp, message, pending,
  } = receipt;

  const total = amount + (fee || 0);
  const dateStr = new Date(timestamp).toLocaleString();

  const handleDownload = () => {
    const lines = [
      "MERIDIAN BANK — TRANSFER " + (pending ? "REQUEST" : "RECEIPT"),
      "================================",
      `Reference:      ${reference}`,
      `Date:           ${dateStr}`,
      `Status:         ${pending ? "Pending admin approval" : "Completed"}`,
      `From account:   ${formatAccountNumber(from_account)}`,
      `To account:     ${formatAccountNumber(to_account)}`,
      `Description:    ${description || "—"}`,
      `Amount:         $${amount.toFixed(2)}`,
      `Fee:            $${(fee || 0).toFixed(2)}`,
      `Total ${pending ? "to debit" : "debited"}: $${total.toFixed(2)}`,
      "",
      "This is a demo receipt from a fictional banking platform.",
    ].join("\n");

    const blob = new Blob([lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pending ? "transfer_request" : "receipt"}_${reference}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-4 print:bg-white">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 print:shadow-none">
        <div className="mb-2 flex items-center justify-between print:hidden">
          <span className={`flex items-center gap-2 text-sm font-medium ${pending ? "text-amber-600" : "text-emerald"}`}>
            {pending ? <Clock size={17} /> : <CheckCircle2 size={17} />}
            {pending ? "Awaiting admin approval" : "Transfer complete"}
          </span>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div className="my-4 text-center">
          <p className="font-display text-3xl">${amount.toFixed(2)}</p>
          <p className="mt-1 text-sm text-muted">{message}</p>
        </div>

        <dl className="divide-y divide-line rounded-xl border border-line text-sm">
          <Row label="Reference" value={reference} mono />
          <Row label="Date" value={dateStr} />
          <Row label="From" value={formatAccountNumber(from_account)} mono />
          <Row label="To" value={formatAccountNumber(to_account)} mono />
          <Row label="Description" value={description || "—"} />
          <Row label="Fee" value={`$${(fee || 0).toFixed(2)}`} mono />
          <Row label={pending ? "Total to be debited" : "Total debited"} value={`$${total.toFixed(2)}`} mono bold />
        </dl>

        {pending && (
          <p className="mt-3 text-xs text-muted">
            Your balance won't change until an admin reviews and approves this request. Track its
            status from your dashboard's Pending transfers section.
          </p>
        )}

        <div className="mt-5 flex gap-2 print:hidden">
          <button
            onClick={handleDownload}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-line py-2.5 text-sm font-medium hover:bg-paper"
          >
            <Download size={15} /> Download
          </button>
          <button
            onClick={() => window.print()}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-line py-2.5 text-sm font-medium hover:bg-paper"
          >
            <Printer size={15} /> Print
          </button>
        </div>

        <button
          onClick={onClose}
          className="mt-2 w-full rounded-lg bg-ink py-2.5 text-sm font-medium text-white hover:opacity-90 print:hidden"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, mono, bold }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <dt className="text-muted">{label}</dt>
      <dd className={`${mono ? "font-ledger" : ""} ${bold ? "font-semibold" : ""}`}>{value}</dd>
    </div>
  );
}
