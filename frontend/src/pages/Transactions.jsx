import React, { useEffect, useState, useCallback } from "react";
import Layout from "../components/Layout.jsx";
import { api } from "../lib/api.js";
import { formatAccountNumber } from "../lib/format.js";

export default function Transactions() {
  const [accounts, setAccounts] = useState([]);
  const [selected, setSelected] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadTx = useCallback(async (accountId) => {
    if (!accountId) return;
    setLoading(true);
    const data = await api.get(`/api/accounts/${accountId}/transactions?limit=100`);
    setTransactions(data.transactions);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const accData = await api.get("/api/accounts");
      setAccounts(accData.accounts);
      if (accData.accounts[0]) {
        setSelected(accData.accounts[0].account_id);
        loadTx(accData.accounts[0].account_id);
      }
    })();
  }, [loadTx]);

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl">Transactions</h1>
        <select
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            loadTx(e.target.value);
          }}
          className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-mono"
        >
          {accounts.map((a) => (
            <option key={a.account_id} value={a.account_id}>
              {formatAccountNumber(a.account_id)} — {a.account_type}
            </option>
          ))}
        </select>
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
            {!loading && transactions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-muted">
                  No transactions on this account yet.
                </td>
              </tr>
            )}
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-paper/40">
                <td className="whitespace-nowrap px-6 py-3.5 font-ledger text-xs text-muted">
                  {new Date(tx.timestamp).toLocaleString()}
                </td>
                <td className="px-6 py-3.5 capitalize">{tx.description || tx.type.replace("_", " ")}</td>
                <td className="px-6 py-3.5 font-ledger text-xs text-muted">{tx.counterparty_account ? formatAccountNumber(tx.counterparty_account) : "—"}</td>
                <td
                  className={`px-6 py-3.5 text-right font-ledger font-medium ${
                    tx.type === "transfer_out" || tx.type === "withdrawal" ? "text-ink" : "text-emerald"
                  }`}
                >
                  {tx.type === "transfer_out" || tx.type === "withdrawal" ? "−" : "+"}$
                  {tx.amount.toFixed(2)}
                </td>
                <td className="px-6 py-3.5 text-right font-ledger text-muted">${tx.balance_after.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
