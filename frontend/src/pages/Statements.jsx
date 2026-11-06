import React, { useEffect, useState, useCallback } from "react";
import { Download, FileText, Search, FileDown } from "lucide-react";
import Layout from "../components/Layout.jsx";
import { SkeletonRow } from "../components/Skeleton.jsx";
import { api, downloadStatement, downloadStatementPdf } from "../lib/api.js";
import { formatAccountNumber } from "../lib/format.js";

export default function Statements() {
  const [accounts, setAccounts] = useState([]);
  const [selected, setSelected] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [query, setQuery] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const filters = { start_date: startDate, end_date: endDate, q: query };

  const loadPreview = useCallback(async (accountId, f) => {
    if (!accountId) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (f.start_date) params.set("start_date", f.start_date);
    if (f.end_date) params.set("end_date", f.end_date);
    if (f.q) params.set("q", f.q);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const data = await api.get(`/api/statements/${accountId}/preview${qs}`);
    setTransactions(data.transactions);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const data = await api.get("/api/accounts");
      setAccounts(data.accounts);
      if (data.accounts[0]) {
        setSelected(data.accounts[0].account_id);
        loadPreview(data.accounts[0].account_id, {});
      }
    })();
  }, [loadPreview]);

  useEffect(() => {
    if (!selected) return;
    const t = setTimeout(() => loadPreview(selected, filters), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, startDate, endDate, query]);

  return (
    <Layout>
      <h1 className="mb-2 font-display text-3xl">Statements</h1>
      <p className="mb-6 text-sm text-muted">Filter, search, and export transaction history for any account.</p>

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Account</label>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-mono"
          >
            {accounts.map((a) => (
              <option key={a.account_id} value={a.account_id}>
                {formatAccountNumber(a.account_id)} — {a.account_type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-muted">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-mono"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-muted">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-mono"
          />
        </div>

        <div className="relative flex-1 min-w-[180px]">
          <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Search</label>
          <Search size={14} className="absolute left-3 top-[38px] text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Description, counterparty…"
            className="w-full rounded-lg border border-line bg-white py-2 pl-9 pr-3 text-sm"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => downloadStatement(selected, filters)}
            className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium hover:bg-paper"
          >
            <Download size={15} /> CSV
          </button>
          <button
            onClick={() => downloadStatementPdf(selected, filters)}
            className="flex items-center gap-2 rounded-lg bg-ink px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <FileDown size={15} /> PDF
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-paper/60 text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-6 py-3 font-medium">Date</th>
              <th className="px-6 py-3 font-medium">Description</th>
              <th className="px-6 py-3 font-medium">Counterparty</th>
              <th className="px-6 py-3 text-right font-medium">Amount</th>
              <th className="px-6 py-3 text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}><td colSpan={5}><SkeletonRow /></td></tr>
            ))}
            {!loading && transactions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-muted">
                  No transactions match these filters.
                </td>
              </tr>
            )}
            {!loading && transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-paper/40">
                <td className="whitespace-nowrap px-6 py-3 font-ledger text-xs text-muted">
                  {new Date(tx.timestamp).toLocaleDateString()}
                </td>
                <td className="px-6 py-3 capitalize">{tx.description || tx.type.replace("_", " ")}</td>
                <td className="px-6 py-3 font-ledger text-xs text-muted">{tx.counterparty_account ? formatAccountNumber(tx.counterparty_account) : "—"}</td>
                <td className={`px-6 py-3 text-right font-ledger font-medium ${
                  tx.type === "transfer_out" || tx.type === "withdrawal" ? "text-ink" : "text-emerald"
                }`}>
                  {tx.type === "transfer_out" || tx.type === "withdrawal" ? "−" : "+"}${tx.amount.toFixed(2)}
                </td>
                <td className="px-6 py-3 text-right font-ledger text-muted">${tx.balance_after.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && transactions.length > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
          <FileText size={12} /> {transactions.length} transaction{transactions.length !== 1 && "s"} in this view — exports use the same filters.
        </p>
      )}
    </Layout>
  );
}
