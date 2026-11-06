import React, { useEffect, useState } from "react";
import {
  ShieldCheck, Clock, XCircle, CheckCircle2, ChevronRight, ChevronLeft,
  UploadCloud, Camera, FileCheck2,
} from "lucide-react";
import Layout from "../components/Layout.jsx";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const STATUS_META = {
  unverified: { label: "Not started", color: "text-muted", icon: ShieldCheck },
  pending: { label: "Under review", color: "text-amber-600", icon: Clock },
  verified: { label: "Verified", color: "text-emerald", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "text-alert", icon: XCircle },
};

const STEPS = ["Personal", "Address", "ID document", "Selfie", "Review"];

export default function KYC() {
  const { user, refresh } = useAuth();
  const [record, setRecord] = useState(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    legal_name: "", date_of_birth: "", address: "", ssn_last4: "",
    id_type: "passport", id_number: "",
  });
  const [docUploaded, setDocUploaded] = useState(false);
  const [selfieTaken, setSelfieTaken] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const load = async () => {
    const data = await api.get("/api/kyc/status");
    setRecord(data.record);
  };

  useEffect(() => {
    load();
  }, []);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const stepValid = [
    form.legal_name.trim() && form.date_of_birth,
    form.address.trim(),
    form.id_number.trim(),
    docUploaded && selfieTaken,
    true,
  ][step];

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const handleSubmit = async () => {
    setError("");
    setBusy(true);
    try {
      await api.post("/api/kyc/submit", form);
      setSubmitted(true);
      await load();
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const status = user?.kyc_status || "unverified";
  const meta = STATUS_META[status] || STATUS_META.unverified;
  const StatusIcon = meta.icon;
  const showWizard = (status === "unverified" || status === "rejected") && !submitted;

  return (
    <Layout>
      <h1 className="mb-2 font-display text-3xl">Identity verification</h1>
      <p className="mb-6 text-sm text-muted">
        Required before higher transfer limits and new account types can be enabled (KYC/AML compliance).
      </p>

      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-line bg-white shadow-sm px-6 py-4">
        <StatusIcon size={20} className={meta.color} />
        <div>
          <p className={`text-sm font-medium ${meta.color}`}>{meta.label}</p>
          {status === "rejected" && record?.rejection_reason && (
            <p className="mt-0.5 text-xs text-muted">Reason: {record.rejection_reason}</p>
          )}
        </div>
      </div>

      {showWizard && (
        <div className="rounded-2xl border border-line bg-white shadow-sm p-6">
          {/* Step indicator */}
          <div className="mb-6 flex items-center gap-2">
            {STEPS.map((label, i) => (
              <React.Fragment key={label}>
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium ${
                      i < step ? "bg-emerald text-white" : i === step ? "bg-ink text-white" : "bg-paper text-muted"
                    }`}
                  >
                    {i < step ? <CheckCircle2 size={13} /> : i + 1}
                  </div>
                  <span className={`hidden text-xs sm:inline ${i === step ? "text-ink font-medium" : "text-muted"}`}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && <div className="h-px flex-1 bg-line" />}
              </React.Fragment>
            ))}
          </div>

          {step === 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Legal name">
                <input
                  autoFocus
                  value={form.legal_name}
                  onChange={update("legal_name")}
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-emerald focus:outline-none"
                />
              </Field>
              <Field label="Date of birth">
                <input type="date" value={form.date_of_birth} onChange={update("date_of_birth")} className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-emerald focus:outline-none" />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <Field label="Residential address">
                <input value={form.address} onChange={update("address")} className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-emerald focus:outline-none" autoFocus />
              </Field>
              <Field label="SSN / national ID last 4 digits (optional)">
                <input maxLength={4} value={form.ssn_last4} onChange={update("ssn_last4")} className="w-full rounded-lg border border-line px-3 py-2 text-sm font-mono focus:border-emerald focus:outline-none" />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Field label="ID type">
                <select value={form.id_type} onChange={update("id_type")} className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-emerald focus:outline-none">
                  <option value="passport">Passport</option>
                  <option value="drivers_license">Driver's license</option>
                  <option value="national_id">National ID</option>
                </select>
              </Field>
              <Field label="ID number">
                <input value={form.id_number} onChange={update("id_number")} className="w-full rounded-lg border border-line px-3 py-2 text-sm font-mono focus:border-emerald focus:outline-none" autoFocus />
              </Field>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Upload ID document</label>
                <button
                  type="button"
                  onClick={() => setDocUploaded(true)}
                  className={`flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-sm transition-colors ${
                    docUploaded ? "border-emerald bg-emerald-soft text-emerald-deep" : "border-line text-muted hover:bg-paper"
                  }`}
                >
                  {docUploaded ? <FileCheck2 size={22} /> : <UploadCloud size={22} />}
                  {docUploaded ? "Document received (demo)" : "Click to simulate a document upload"}
                </button>
                <p className="mt-1.5 text-xs text-muted">
                  Demo placeholder — no real file is uploaded, stored, or verified.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Selfie verification</label>
              <button
                type="button"
                onClick={() => setSelfieTaken(true)}
                className={`flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-sm transition-colors ${
                  selfieTaken ? "border-emerald bg-emerald-soft text-emerald-deep" : "border-line text-muted hover:bg-paper"
                }`}
              >
                {selfieTaken ? <CheckCircle2 size={26} /> : <Camera size={26} />}
                {selfieTaken ? "Selfie captured (demo)" : "Click to simulate taking a selfie"}
              </button>
              <p className="mt-1.5 text-xs text-muted">
                Demo placeholder — no camera is accessed and no image is captured or stored. A real
                deployment would use a licensed identity-verification provider here, not a DIY selfie check.
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <ReviewRow label="Legal name" value={form.legal_name} />
              <ReviewRow label="Date of birth" value={form.date_of_birth} />
              <ReviewRow label="Address" value={form.address} />
              <ReviewRow label="SSN last 4" value={form.ssn_last4 || "—"} />
              <ReviewRow label="ID type" value={form.id_type.replace("_", " ")} />
              <ReviewRow label="ID number" value={form.id_number} />
              <ReviewRow label="Document" value="Received (demo)" />
              <ReviewRow label="Selfie" value="Captured (demo)" />
              <p className="pt-2 text-xs text-muted">
                This information is encrypted at rest and only visible to compliance reviewers.
              </p>
            </div>
          )}

          {error && <p className="mt-4 text-sm text-alert">{error}</p>}

          <div className="mt-6 flex justify-between">
            <button
              onClick={back}
              disabled={step === 0}
              className="flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm font-medium disabled:opacity-0"
            >
              <ChevronLeft size={15} /> Back
            </button>

            {step < STEPS.length - 1 ? (
              <button
                onClick={next}
                disabled={!stepValid}
                className="flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next <ChevronRight size={15} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={busy}
                className="rounded-lg bg-emerald px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Submitting…" : "Submit for review"}
              </button>
            )}
          </div>
        </div>
      )}

      {(status === "pending" || submitted) && (
        <div className="rounded-2xl border border-line bg-white shadow-sm p-6 text-sm text-muted">
          Your information is with our compliance team. This usually takes 1–2 business days in a real
          deployment — in this demo, an admin can approve or reject it from the Admin panel.
        </div>
      )}

      {status === "verified" && (
        <div className="rounded-2xl border border-emerald/30 bg-emerald-soft p-6 text-sm text-emerald-deep">
          You're verified. No further action needed.
        </div>
      )}

    </Layout>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs uppercase tracking-wide text-muted">{label}</label>
      {children}
    </div>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-line pb-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-medium capitalize">{value}</span>
    </div>
  );
}
