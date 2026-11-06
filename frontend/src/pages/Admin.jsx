import React, { useEffect, useState } from "react";
import { Lock, Unlock, AlertTriangle, ShieldCheck, ShieldX, ScrollText, CheckCircle2, ArrowRight, XCircle, Users, Landmark, Clock3, CreditCard } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import Layout from "../components/Layout.jsx";
import { api } from "../lib/api.js";
import { formatAccountNumber } from "../lib/format.js";

const TABS = [
  { id: "analytics", label: "Analytics" },
  { id: "transfers", label: "Pending transfers" },
  { id: "customers", label: "Customers" },
  { id: "flagged", label: "Flagged transactions" },
  { id: "kyc", label: "KYC queue" },
  { id: "audit", label: "Audit log" },
];

export default function Admin() {
  const [tab, setTab] = useState("analytics");
  const [users, setUsers] = useState([]);
  const [pendingTransfers, setPendingTransfers] = useState([]);
  const [flagged, setFlagged] = useState([]);
  const [kycQueue, setKycQueue] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [auditEntries, setAuditEntries] = useState([]);
  const [chainValid, setChainValid] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const loadAll = async () => {
    const [u, t, f, k, a] = await Promise.all([
      api.get("/api/admin/users"),
      api.get("/api/admin/transfers/pending"),
      api.get("/api/admin/transactions/flagged"),
      api.get("/api/admin/kyc/pending"),
      api.get("/api/admin/analytics"),
    ]);
    setUsers(u.users);
    setPendingTransfers(t.transfers);
    setFlagged(f.transactions);
    setKycQueue(k.records);
    setAnalytics(a);
  };

  const loadAudit = async () => {
    const data = await api.get("/api/admin/audit-log?limit=100");
    setAuditEntries(data.entries);
    const verify = await api.get("/api/admin/audit-log/verify");
    setChainValid(verify.chain_valid);
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (tab === "audit") loadAudit();
  }, [tab]);

  const toggleFreeze = async (accountId) => {
    setBusyId(accountId);
    try {
      await api.post(`/api/admin/accounts/${accountId}/toggle-freeze`, {});
      await loadAll();
    } finally {
      setBusyId(null);
    }
  };

  const clearFlag = async (txnId) => {
    setBusyId(txnId);
    try {
      await api.post(`/api/admin/transactions/${txnId}/clear-flag`, {});
      await loadAll();
    } finally {
      setBusyId(null);
    }
  };

  const reviewKyc = async (recordId, decision) => {
    setBusyId(recordId);
    try {
      const reason = decision === "rejected" ? window.prompt("Rejection reason:") || "Not specified" : undefined;
      await api.post(`/api/admin/kyc/${recordId}/review`, { decision, reason });
      await loadAll();
    } finally {
      setBusyId(null);
    }
  };

  const approveTransfer = async (id) => {
    setBusyId(id);
    try {
      await api.post(`/api/admin/transfers/${id}/approve`, {});
      await loadAll();
    } catch (e) {
      window.alert(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const rejectTransfer = async (id) => {
    const reason = window.prompt("Rejection reason:") || "Not specified";
    setBusyId(id);
    try {
      await api.post(`/api/admin/transfers/${id}/reject`, { reason });
      await loadAll();
    } finally {
      setBusyId(null);
    }
  };

  const totalBankBalance = users.reduce(
    (sum, u) => sum + u.accounts.reduce((s, a) => s + a.balance, 0),
    0
  );

  return (
    <Layout>
      <h1 className="mb-2 font-display text-3xl">Admin panel</h1>
      <p className="mb-6 text-sm text-muted">Bank-wide view. Visible only to administrator accounts.</p>

      <div className="mb-6 rounded-2xl border border-line bg-ink px-6 py-5 text-white shadow-lg">
        <p className="text-xs uppercase tracking-wide text-white/50">Total deposits across all customers</p>
        <p className="mt-1 font-display text-3xl font-medium">
          ${totalBankBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id ? "text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
            {t.id === "transfers" && pendingTransfers.length > 0 && (
              <span className="ml-1.5 rounded-full bg-ink/10 px-1.5 py-0.5 text-[10px] font-semibold text-ink">
                {pendingTransfers.length}
              </span>
            )}
            {t.id === "flagged" && flagged.length > 0 && (
              <span className="ml-1.5 rounded-full bg-alert/10 px-1.5 py-0.5 text-[10px] font-semibold text-alert">
                {flagged.length}
              </span>
            )}
            {t.id === "kyc" && kycQueue.length > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                {kycQueue.length}
              </span>
            )}
            {tab === t.id && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-ink" />}
          </button>
        ))}
      </div>

      {tab === "analytics" && analytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MiniStat icon={Users} label="Customers" value={analytics.total_customers} />
            <MiniStat icon={Landmark} label="Accounts" value={analytics.total_accounts} />
            <MiniStat icon={Clock3} label="Pending transfers" value={analytics.pending_transfers_count} sub={`$${analytics.pending_transfers_volume.toFixed(2)}`} />
            <MiniStat icon={CreditCard} label="Cards issued" value={analytics.total_cards} sub={`${analytics.frozen_cards} frozen`} />
          </div>

          <div className="rounded-2xl border border-line bg-white shadow-sm p-6">
            <h2 className="mb-4 font-display text-lg">Transaction volume — last 14 days</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={analytics.daily_volume}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#DCE0DA" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#5B665F" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(d) => d.slice(5)}
                />
                <YAxis tick={{ fontSize: 12, fill: "#5B665F" }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  formatter={(v, name) => (name === "volume" ? `$${v.toFixed(2)}` : v)}
                  contentStyle={{ borderRadius: 10, border: "1px solid #DCE0DA", fontSize: 13 }}
                />
                <Bar dataKey="volume" fill="#1F7A5C" radius={[4, 4, 0, 0]} name="Volume ($)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <BreakdownCard title="KYC status" data={analytics.kyc_breakdown} total={analytics.total_customers} />
            <BreakdownCard title="Accounts by type" data={analytics.accounts_by_type} total={analytics.total_accounts} />
          </div>

          {analytics.flagged_open_count > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-alert/10 px-4 py-3 text-sm text-alert">
              <AlertTriangle size={15} /> {analytics.flagged_open_count} transaction(s) still flagged for review.
            </div>
          )}
        </div>
      )}

      {tab === "transfers" && (
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
          <div className="divide-y divide-line">
            {pendingTransfers.length === 0 && (
              <p className="px-6 py-8 text-center text-sm text-muted">No transfers awaiting approval.</p>
            )}
            {pendingTransfers.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <span className="font-ledger">{formatAccountNumber(t.from_account)}</span>
                    <ArrowRight size={13} className="text-muted" />
                    <span className="font-ledger">{formatAccountNumber(t.to_account)}</span>
                    <span className="font-ledger text-ink">${t.amount.toFixed(2)}</span>
                    {t.is_flagged && (
                      <span className="rounded-full bg-alert/10 px-2 py-0.5 text-[10px] font-medium text-alert">
                        {t.flag_reason?.replaceAll("_", " ")}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {t.reference} · {t.description || "Transfer"} · {new Date(t.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => approveTransfer(t.id)}
                    disabled={busyId === t.id}
                    className="flex items-center gap-1.5 rounded-md bg-emerald px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    <CheckCircle2 size={13} /> Approve
                  </button>
                  <button
                    onClick={() => rejectTransfer(t.id)}
                    disabled={busyId === t.id}
                    className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-alert hover:bg-paper disabled:opacity-50"
                  >
                    <XCircle size={13} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "customers" && (
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
          <div className="divide-y divide-line">
            {users.filter((u) => u.role === "user").map((u) => (
              <div key={u.id} className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{u.full_name}</p>
                  <span className="text-xs text-muted">· {u.username}</span>
                  <KycBadge status={u.kyc_status} />
                </div>
                <div className="mt-2 flex flex-wrap gap-3">
                  {u.accounts.map((a) => (
                    <div key={a.account_id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm">
                      <span className="font-ledger text-xs text-muted">{formatAccountNumber(a.account_id)}</span>
                      <span className="capitalize">{a.account_type}</span>
                      <span className="font-ledger font-medium">${a.balance.toFixed(2)}</span>
                      <button
                        onClick={() => toggleFreeze(a.account_id)}
                        disabled={busyId === a.account_id}
                        className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
                          a.is_frozen ? "bg-alert/10 text-alert" : "bg-paper text-muted hover:bg-line"
                        }`}
                      >
                        {a.is_frozen ? <Unlock size={12} /> : <Lock size={12} />}
                        {a.is_frozen ? "Unfreeze" : "Freeze"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "flagged" && (
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
          <div className="divide-y divide-line">
            {flagged.length === 0 && (
              <p className="px-6 py-8 text-center text-sm text-muted">No transactions currently flagged.</p>
            )}
            {flagged.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={16} className="mt-0.5 text-alert" />
                  <div>
                    <p className="text-sm font-medium">
                      {formatAccountNumber(tx.account_id)} → {formatAccountNumber(tx.counterparty_account)}
                      <span className="ml-2 font-ledger text-ink">${tx.amount.toFixed(2)}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {tx.flag_reason?.replaceAll("_", " ")} · {new Date(tx.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => clearFlag(tx.id)}
                  disabled={busyId === tx.id}
                  className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:bg-paper"
                >
                  <CheckCircle2 size={13} /> Clear
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "kyc" && (
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
          <div className="divide-y divide-line">
            {kycQueue.length === 0 && (
              <p className="px-6 py-8 text-center text-sm text-muted">No KYC submissions awaiting review.</p>
            )}
            {kycQueue.map((r) => (
              <div key={r.id} className="px-6 py-4">
                <p className="text-sm font-medium">{r.legal_name}</p>
                <div className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted sm:grid-cols-4">
                  <span>DOB: {r.date_of_birth}</span>
                  <span className="capitalize">{r.id_type.replace("_", " ")}</span>
                  <span className="font-ledger">ID: {r.id_number}</span>
                  <span>SSN last4: {r.ssn_last4 || "—"}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => reviewKyc(r.id, "verified")}
                    disabled={busyId === r.id}
                    className="flex items-center gap-1.5 rounded-md bg-emerald px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                  >
                    <ShieldCheck size={13} /> Verify
                  </button>
                  <button
                    onClick={() => reviewKyc(r.id, "rejected")}
                    disabled={busyId === r.id}
                    className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-alert hover:bg-paper"
                  >
                    <ShieldX size={13} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "audit" && (
        <div>
          <div className={`mb-4 flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm ${
            chainValid === false ? "bg-alert/10 text-alert" : "bg-emerald-soft text-emerald-deep"
          }`}>
            <ScrollText size={15} />
            {chainValid === null ? "Verifying log integrity…" :
              chainValid ? "Audit chain verified — no tampering detected." :
              "Warning: audit chain integrity check failed."}
          </div>
          <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-paper/60 text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-6 py-3 font-medium">Time</th>
                  <th className="px-6 py-3 font-medium">Action</th>
                  <th className="px-6 py-3 font-medium">Actor</th>
                  <th className="px-6 py-3 font-medium">Target</th>
                  <th className="px-6 py-3 font-medium">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {auditEntries.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap px-6 py-2.5 font-ledger text-xs text-muted">
                      {new Date(e.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-2.5">{e.action.replaceAll("_", " ")}</td>
                    <td className="px-6 py-2.5 font-ledger text-xs">{e.actor_username || "—"}</td>
                    <td className="px-6 py-2.5 font-ledger text-xs text-muted">{e.target || "—"}</td>
                    <td className="px-6 py-2.5">
                      <span className={`text-xs font-medium ${e.success ? "text-emerald" : "text-alert"}`}>
                        {e.success ? "ok" : "failed"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  );
}

function KycBadge({ status }) {
  const styles = {
    verified: "bg-emerald-soft text-emerald-deep",
    pending: "bg-amber-100 text-amber-700",
    rejected: "bg-alert/10 text-alert",
    unverified: "bg-paper text-muted",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[status] || styles.unverified}`}>
      {status}
    </span>
  );
}

function MiniStat({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-2xl border border-line bg-white shadow-sm p-5">
      <div className="flex items-center gap-2 text-muted">
        <Icon size={14} />
        <p className="text-xs uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-2 font-display text-2xl font-medium">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

function BreakdownCard({ title, data, total }) {
  const entries = Object.entries(data || {});
  const colors = { verified: "bg-emerald", pending: "bg-amber-400", rejected: "bg-alert", unverified: "bg-line", checking: "bg-emerald", savings: "bg-ink" };
  return (
    <div className="rounded-2xl border border-line bg-white shadow-sm p-6">
      <h2 className="mb-4 font-display text-lg">{title}</h2>
      <div className="space-y-3">
        {entries.map(([key, count]) => (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="capitalize text-muted">{key}</span>
              <span className="font-ledger">{count}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper">
              <div
                className={`h-full rounded-full ${colors[key] || "bg-ink"}`}
                style={{ width: total > 0 ? `${(count / total) * 100}%` : "0%" }}
              />
            </div>
          </div>
        ))}
        {entries.length === 0 && <p className="text-sm text-muted">No data yet.</p>}
      </div>
    </div>
  );
}
