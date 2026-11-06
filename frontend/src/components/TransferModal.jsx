import React, { useState, useEffect, useRef } from "react";
import { X, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { api } from "../lib/api.js";
import OTPInput from "./OTPInput.jsx";
import { formatAccountNumber, stripAccountNumber } from "../lib/format.js";

const FEE = 0.0;

export default function TransferModal({ accounts, onClose, onSuccess }) {
  const [step, setStep] = useState("form"); // form -> confirm -> otp
  const [fromAccount, setFromAccount] = useState(accounts[0]?.account_id || "");
  const [toAccountDisplay, setToAccountDisplay] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [recipient, setRecipient] = useState(null); // {holder_name, account_type, is_frozen} | null
  const [lookupState, setLookupState] = useState("idle"); // idle | loading | found | notfound
  const debounceRef = useRef(null);

  const toAccount = stripAccountNumber(toAccountDisplay);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    setRecipient(null);
    if (!toAccount) {
      setLookupState("idle");
      return;
    }
    setLookupState("loading");
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api.get(`/api/accounts/lookup/${toAccount}`);
        setRecipient(data);
        setLookupState("found");
      } catch {
        setLookupState("notfound");
      }
    }, 450);
    return () => clearTimeout(debounceRef.current);
  }, [toAccount]);

  const sender = accounts.find((a) => a.account_id === fromAccount);
  const amountNum = parseFloat(amount) || 0;
  const total = amountNum + FEE;

  const canContinue =
    lookupState === "found" && toAccount !== fromAccount && amountNum > 0 &&
    sender && amountNum <= sender.balance;

  const goToConfirm = (e) => {
    e.preventDefault();
    setError("");
    if (toAccount === fromAccount) {
      setError("Choose a different recipient account.");
      return;
    }
    if (sender && amountNum > sender.balance) {
      setError("That's more than the account balance.");
      return;
    }
    setStep("confirm");
  };

  const requestOtp = async () => {
    setError("");
    setBusy(true);
    try {
      await api.post("/api/otp/request", {});
      setStep("otp");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submitTransfer = async (code) => {
    setError("");
    setBusy(true);
    try {
      const res = await api.post("/api/transfer", {
        from_account: fromAccount,
        to_account: toAccount,
        amount: amountNum,
        otp: code,
        description,
      });
      onSuccess(res);
    } catch (e) {
      setError(e.message);
      setOtp("");
    } finally {
      setBusy(false);
    }
  };

  const handleOtpChange = (val) => {
    setOtp(val);
    if (val.length === 6) submitTransfer(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {step !== "form" && (
              <button
                onClick={() => setStep(step === "otp" ? "confirm" : "form")}
                className="text-muted hover:text-ink"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <h2 className="font-display text-xl">
              {step === "form" && "New transfer"}
              {step === "confirm" && "Review transfer"}
              {step === "otp" && "Verify it's you"}
            </h2>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>

        {step === "form" && (
          <form onSubmit={goToConfirm} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-muted">From</label>
              <select
                value={fromAccount}
                onChange={(e) => setFromAccount(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm font-ledger focus:border-emerald focus:outline-none"
              >
                {accounts.map((a) => (
                  <option key={a.account_id} value={a.account_id}>
                    {formatAccountNumber(a.account_id)} — {a.account_type} (${a.balance.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-muted">To account</label>
              <input
                value={toAccountDisplay}
                onChange={(e) => setToAccountDisplay(formatAccountNumber(e.target.value))}
                placeholder="1234 5678 9012 3456"
                inputMode="numeric"
                maxLength={19}
                required
                className="w-full rounded-lg border border-line px-3 py-2 text-sm font-ledger focus:border-emerald focus:outline-none"
              />
              <div className="mt-1.5 min-h-[18px] text-xs">
                {lookupState === "loading" && (
                  <span className="flex items-center gap-1.5 text-muted">
                    <Loader2 size={12} className="animate-spin" /> Looking up account…
                  </span>
                )}
                {lookupState === "found" && recipient && (
                  <span className="flex items-center gap-1.5 text-emerald">
                    <CheckCircle2 size={12} /> {recipient.holder_name} · {recipient.account_type}
                    {recipient.is_frozen && " (frozen)"}
                  </span>
                )}
                {lookupState === "notfound" && (
                  <span className="flex items-center gap-1.5 text-alert">
                    <AlertCircle size={12} /> No account found with that number.
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Amount (USD)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full rounded-lg border border-line px-3 py-2 text-sm font-mono focus:border-emerald focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Note (optional)</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Rent, gift, etc."
                className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-emerald focus:outline-none"
              />
            </div>

            {error && <p className="text-sm text-alert">{error}</p>}

            <button
              type="submit"
              disabled={!canContinue}
              className="w-full rounded-lg bg-ink py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue
            </button>
          </form>
        )}

        {step === "confirm" && (
          <div className="space-y-5">
            <dl className="divide-y divide-line rounded-xl border border-line text-sm">
              <Row label="From" value={`${formatAccountNumber(fromAccount)} (${sender?.account_type})`} mono />
              <Row label="To" value={`${formatAccountNumber(toAccount)} — ${recipient?.holder_name}`} mono />
              <Row label="Amount" value={`$${amountNum.toFixed(2)}`} mono />
              <Row label="Fee" value={`$${FEE.toFixed(2)}`} mono />
              <Row label="Total debit" value={`$${total.toFixed(2)}`} mono bold />
              {description && <Row label="Note" value={description} />}
            </dl>

            {error && <p className="text-sm text-alert">{error}</p>}

            <button
              onClick={requestOtp}
              disabled={busy}
              className="w-full rounded-lg bg-emerald py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Sending code…" : "Send verification code"}
            </button>
          </div>
        )}

        {step === "otp" && (
          <div className="space-y-5 text-center">
            <p className="text-sm text-muted">Enter the 6-digit code sent to your phone on file.</p>
            <OTPInput value={otp} onChange={handleOtpChange} disabled={busy} />
            {error && <p className="text-sm text-alert">{error}</p>}
            {busy && <p className="text-xs text-muted">Processing…</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono, bold }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <dt className="text-muted">{label}</dt>
      <dd className={`text-right ${mono ? "font-ledger" : ""} ${bold ? "font-semibold" : ""}`}>{value}</dd>
    </div>
  );
}
