import React, { useEffect, useState, useRef } from "react";
import { Snowflake, Eye, EyeOff, Copy, Check, Plus, Sliders } from "lucide-react";
import Layout from "../components/Layout.jsx";
import { formatAccountNumber } from "../lib/format.js";
import { api } from "../lib/api.js";

const REVEAL_TIMEOUT_MS = 15000;

export default function Cards() {
  const [cards, setCards] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [creatingVirtual, setCreatingVirtual] = useState(false);

  const load = async () => {
    const [cardData, accData] = await Promise.all([
      api.get("/api/cards"),
      api.get("/api/accounts"),
    ]);
    setCards(cardData.cards);
    setAccounts(accData.accounts);
  };

  useEffect(() => {
    load();
  }, []);

  const toggleFreeze = async (id) => {
    setBusyId(id);
    try {
      await api.post(`/api/cards/${id}/toggle-freeze`, {});
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const checkingAccountsWithoutVirtual = accounts.filter(
    (a) => a.account_type === "checking" && !cards.some((c) => c.account_id === a.account_id && c.is_virtual)
  );

  const createVirtualCard = async (accountId) => {
    setCreatingVirtual(true);
    try {
      await api.post("/api/cards/virtual", { account_id: accountId });
      await load();
    } finally {
      setCreatingVirtual(false);
    }
  };

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl">Cards</h1>
        {checkingAccountsWithoutVirtual.length > 0 && (
          <button
            onClick={() => createVirtualCard(checkingAccountsWithoutVirtual[0].account_id)}
            disabled={creatingVirtual}
            className="flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <Plus size={15} /> {creatingVirtual ? "Creating…" : "Create virtual card"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {cards.map((card) => (
          <CardTile key={card.id} card={card} busy={busyId === card.id} onToggleFreeze={() => toggleFreeze(card.id)} onLimitSaved={load} />
        ))}
      </div>
    </Layout>
  );
}

function CardTile({ card, busy, onToggleFreeze, onLimitSaved }) {
  const [revealed, setRevealed] = useState(null); // {full_number, cvv} | null
  const [revealing, setRevealing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingLimit, setEditingLimit] = useState(false);
  const [limitInput, setLimitInput] = useState(card.spending_limit);
  const [savingLimit, setSavingLimit] = useState(false);
  const hideTimer = useRef(null);

  const toggleReveal = async () => {
    if (revealed) {
      setRevealed(null);
      clearTimeout(hideTimer.current);
      return;
    }
    setRevealing(true);
    try {
      const data = await api.post(`/api/cards/${card.id}/reveal`, {});
      setRevealed(data);
      hideTimer.current = setTimeout(() => setRevealed(null), REVEAL_TIMEOUT_MS);
    } finally {
      setRevealing(false);
    }
  };

  const copyNumber = () => {
    if (!revealed) return;
    navigator.clipboard?.writeText(revealed.full_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const saveLimit = async () => {
    setSavingLimit(true);
    try {
      await api.post(`/api/cards/${card.id}/limit`, { limit: limitInput });
      setEditingLimit(false);
      onLimitSaved();
    } finally {
      setSavingLimit(false);
    }
  };

  const displayNumber = revealed
    ? revealed.full_number.replace(/(.{4})/g, "$1 ").trim()
    : `•••• •••• •••• ${card.last4}`;

  return (
    <div>
      <div
        className={`relative aspect-[1.586/1] rounded-2xl p-6 text-white transition-opacity ${
          card.status === "frozen"
            ? "bg-ink/50"
            : card.is_virtual
            ? "bg-gradient-to-br from-emerald-deep to-ink border border-dashed border-white/20"
            : "bg-gradient-to-br from-ink to-ink-soft"
        }`}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-white/50">
            {card.is_virtual ? "Meridian Virtual" : "Meridian Debit"}
          </p>
          {card.is_virtual && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium">Online only</span>
          )}
        </div>

        <p className="mt-7 font-ledger text-lg tracking-[0.15em]">{displayNumber}</p>

        <div className="mt-5 flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase text-white/40">Linked account</p>
            <p className="font-ledger text-xs">{formatAccountNumber(card.account_id)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-white/40">Expires</p>
            <p className="font-ledger text-xs">{card.expiry}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-white/40">CVV</p>
            <p className="font-ledger text-xs">{revealed ? revealed.cvv : "•••"}</p>
          </div>
        </div>

        {card.status === "frozen" && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-ink/40">
            <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-ink">
              <Snowflake size={13} /> Frozen
            </span>
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={toggleReveal}
          disabled={revealing}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line py-2 text-xs font-medium hover:bg-paper disabled:opacity-50"
        >
          {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
          {revealing ? "Loading…" : revealed ? "Hide" : "Reveal"}
        </button>
        {revealed && (
          <button
            onClick={copyNumber}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line py-2 text-xs font-medium hover:bg-paper"
          >
            {copied ? <Check size={13} className="text-emerald" /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy"}
          </button>
        )}
        <button
          onClick={onToggleFreeze}
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line py-2 text-xs font-medium hover:bg-paper disabled:opacity-50"
        >
          {busy ? "…" : card.status === "frozen" ? "Unfreeze" : "Freeze"}
        </button>
      </div>

      <div className="mt-2 rounded-lg border border-line px-3 py-2">
        {!editingLimit ? (
          <button
            onClick={() => setEditingLimit(true)}
            className="flex w-full items-center justify-between text-xs text-muted"
          >
            <span className="flex items-center gap-1.5">
              <Sliders size={12} /> Spending limit
            </span>
            <span className="font-ledger text-ink">${card.spending_limit.toFixed(2)}/mo</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="50"
              value={limitInput}
              onChange={(e) => setLimitInput(e.target.value)}
              className="w-full rounded-md border border-line px-2 py-1 text-xs font-mono focus:border-emerald focus:outline-none"
            />
            <button
              onClick={saveLimit}
              disabled={savingLimit}
              className="shrink-0 rounded-md bg-emerald px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
            >
              {savingLimit ? "…" : "Save"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
