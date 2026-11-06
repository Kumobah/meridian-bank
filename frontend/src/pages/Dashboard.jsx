import React, { useEffect, useState, useCallback } from "react";
import { Plus, Download as DownloadIcon, ArrowDownToLine, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import StatCard from "../components/StatCard.jsx";
import TransferModal from "../components/TransferModal.jsx";
import ReceiveModal from "../components/ReceiveModal.jsx";
import Receipt from "../components/Receipt.jsx";
import { SkeletonStatCard, SkeletonRow } from "../components/Skeleton.jsx";
import { api } from "../lib/api.js";
import { formatAccountNumber } from "../lib/format.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function Dashboard() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [recent, setRecent] = useState([]);
  const [pendingTransfers, setPendingTransfers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showTransfer, setShowTransfer] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    const [accData, pendingData] = await Promise.all([
      api.get("/api/accounts"),
      api.get("/api/transfers/pending"),
    ]);
    setAccounts(accData.accounts);
    setPendingTransfers(pendingData.transfers);

    const txLists = await Promise.all(
      accData.accounts.map((a) => api.get(`/api/accounts/${a.account_id}/transactions?limit=5`))
    );
    const merged = txLists.flatMap((t) => t.transactions);
    merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    setRecent(merged.slice(0, 6));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleTransferSuccess = (res) => {
    setShowTransfer(false);
    setReceipt(res);
    load();
  };

  const closeReceipt = () => {
    setReceipt(null);
    setToast("Transfer submitted.");
    setTimeout(() => setToast(""), 4000);
  };

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <Layout>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Good to see you,</p>
          <h1 className="font-display text-3xl">{user?.full_name?.split(" ")[0]}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowReceive(true)}
            className="flex items-center gap-2 rounded-lg border border-line px-4 py-2.5 text-sm font-medium hover:bg-paper"
          >
            <ArrowDownToLine size={16} /> Receive
          </button>
          <button
            onClick={() => setShowTransfer(true)}
            className="flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus size={16} /> Send money
          </button>
        </div>
      </div>

      {toast && (
        <div className="mb-6 rounded-lg border border-emerald/30 bg-emerald-soft px-4 py-3 text-sm text-emerald-deep">
          {toast}
        </div>
      )}

      {/* ── Balance ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="mb-6 h-28 animate-pulse rounded-2xl bg-paper" />
      ) : (
        <div className="mb-6 rounded-2xl border border-line bg-ink px-6 py-5 text-white shadow-lg">
          <p className="text-xs uppercase tracking-wide text-white/50">Total balance</p>
          <p className="mt-1 font-display text-4xl font-medium">
            ${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {loading
          ? Array.from({ length: 2 }).map((_, i) => <SkeletonStatCard key={i} />)
          : accounts.map((a) => (
              <StatCard
                key={a.account_id}
                label={a.account_type}
                accountId={a.account_id}
                amount={a.balance}
                type={a.account_type}
                frozen={a.is_frozen}
              />
            ))}
      </div>

      {/* ── Pending transfers ────────────────────────────────────── */}
      {!loading && pendingTransfers.length > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-400/40 bg-amber-100/40">
          <div className="border-b border-amber-400/30 px-6 py-3">
            <h2 className="flex items-center gap-2 text-sm font-medium text-amber-700">
              <Clock size={14} /> Pending admin approval
            </h2>
          </div>
          <div className="divide-y divide-amber-400/20">
            {pendingTransfers.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {formatAccountNumber(t.from_account)} → {formatAccountNumber(t.to_account)}
                    {t.is_flagged && (
                      <span className="ml-2 rounded-full bg-alert/10 px-2 py-0.5 text-[10px] font-medium text-alert">
                        Flagged
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {t.reference} · submitted {new Date(t.created_at).toLocaleString()}
                  </p>
                </div>
                <p className="font-ledger text-sm font-medium">${t.amount.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recent activity ─────────────────────────────────────── */}
      <div className="rounded-2xl border border-line bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-display text-lg">Recent activity</h2>
          <Link to="/transactions" className="text-xs font-medium text-emerald hover:underline">View all</Link>
        </div>
        <div className="divide-y divide-line">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
          ) : recent.length === 0 ? (
            <p className="px-6 py-6 text-sm text-muted">No transactions yet.</p>
          ) : (
            recent.map((tx) => (
              <div key={`${tx.account_id}-${tx.id}`} className="flex items-center justify-between px-6 py-3.5">
                <div>
                  <p className="text-sm font-medium capitalize">{tx.description || tx.type.replace("_", " ")}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatAccountNumber(tx.account_id)} · {new Date(tx.timestamp).toLocaleString()}
                  </p>
                </div>
                <p
                  className={`font-ledger text-sm font-medium ${
                    tx.type === "transfer_out" || tx.type === "withdrawal" ? "text-ink" : "text-emerald"
                  }`}
                >
                  {tx.type === "transfer_out" || tx.type === "withdrawal" ? "−" : "+"}$
                  {tx.amount.toFixed(2)}
                </p>
              </div>
            ))
          )}
        </div>
        <div className="border-t border-line px-6 py-3">
          <Link to="/statements" className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink">
            <DownloadIcon size={13} /> Download a statement
          </Link>
        </div>
      </div>

      {showTransfer && (
        <TransferModal accounts={accounts} onClose={() => setShowTransfer(false)} onSuccess={handleTransferSuccess} />
      )}
      {showReceive && <ReceiveModal accounts={accounts} onClose={() => setShowReceive(false)} />}
      {receipt && <Receipt receipt={receipt} onClose={closeReceipt} />}
    </Layout>
  );
}
