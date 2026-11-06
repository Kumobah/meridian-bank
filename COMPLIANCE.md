# Compliance notes

This document is honest about two things: what this project actually
implements, and the (much longer) list of what real regulatory compliance
requires that no amount of solo coding replaces. Don't present this app as
"PCI-DSS compliant" or "AML compliant" anywhere real — compliance is a
certification process involving auditors and lawyers, not a checklist of
code changes.

## What's implemented here

**Data protection**
- Passwords: PBKDF2 hashing via Werkzeug, never stored or logged in plaintext.
- PII at rest (email, phone, KYC documents): encrypted with Fernet
  (AES-128-CBC + HMAC) using a key kept outside the codebase (`.env`).
- Card numbers: full PANs are encrypted at rest (same Fernet scheme as other
  PII) to support the "reveal card number" UI feature, and only decrypted
  on an explicit, audit-logged request from the account owner. **This is a
  real trade-off, not a minor detail**: an earlier version of this project
  stored only the last 4 digits and touched no full PAN at all, which is the
  single biggest thing that reduces PCI-DSS scope in a real design. Storing
  encrypted full PANs — even encrypted, even access-controlled — pulls a
  real system back into much stricter PCI requirements (tokenization, HSMs,
  network segmentation). If you're using this as a portfolio/learning
  reference for PCI scope reduction specifically, the last-4-only design was
  the better example; this version trades that for the reveal-number UX. A
  real production system would use a PCI-compliant card issuer/processor's
  API to fetch numbers on demand rather than storing them at all, even
  encrypted.
- OTP codes: stored as a salted hash, not plaintext, and single-use.
- Transport: security headers set on every response (`X-Frame-Options`,
  `X-Content-Type-Options`, `Referrer-Policy`, HSTS when `BANK_HTTPS=1`).

**Access control & integrity**
- Session cookies: httponly, SameSite=Lax, 15-minute expiry.
- CSRF tokens required on every state-changing request.
- Per-username login rate limiting (5 attempts / 60s lockout).
- Role-based access control (`user` vs `admin`) enforced server-side on
  every admin route, not just hidden in the UI.
- Audit log: every login, transfer, freeze/unfreeze, KYC decision, and
  statement download is recorded with a hash chained to the previous entry
  (`audit.py`). `GET /api/admin/audit-log/verify` walks the whole chain and
  reports if any row was edited or deleted out of band — this is a real,
  useful integrity check, though it's not a substitute for shipping logs to
  an external, access-controlled system (which a real deployment needs).

**KYC (Know Your Customer)**
- Users submit legal name, DOB, ID type/number, address, encrypted at rest.
- Records sit in a `pending` queue until an admin explicitly approves or
  rejects them (`/api/admin/kyc/pending`, `/api/admin/kyc/<id>/review`).
- A rejected submission records a reason and can be resubmitted.

**AML (Anti-Money-Laundering) monitoring**
- Transfers ≥ $10,000 are auto-flagged for review (modeled on the US
  Currency Transaction Report trigger).
- Structuring detection: 3+ transfers in the $9,000–$9,999.99 band from the
  same account within 24 hours get flagged as possible "smurfing."
- Flagged transactions land in an admin queue and stay flagged until an
  admin explicitly clears them — nothing is auto-approved or auto-blocked.

## What real compliance actually requires (and this doesn't provide)

**PCI-DSS** (if you ever handle real card numbers, not just last-4 display):
- A PCI Qualified Security Assessor (QSA) audit and Attestation of
  Compliance — this is a certification, not a code state.
- Full network segmentation of the cardholder data environment, not just
  "the DB is encrypted."
- A real HSM or PCI-validated tokenization provider — application-level
  Fernet encryption with a key in an `.env` file is not an approved control
  for storing real PANs.
- Formal vulnerability scanning (ASV scans), penetration testing, and
  quarterly reviews.
- Realistically: for anything handling real cards, use a PCI-compliant
  processor (Stripe, Adyen, etc.) and never let raw PANs touch your servers
  at all. That's the standard advice, not a corner being cut here.

**KYC/AML (US context, as an example — every jurisdiction differs)**
- A licensed Bank Secrecy Act (BSA) Officer and a written, board-approved
  AML program — this is a legal/organizational requirement, not software.
- OFAC and sanctions-list screening against every new customer and every
  counterparty on every transfer (this app does none of that).
- Suspicious Activity Report (SAR) filing with FinCEN when patterns like
  structuring are detected — flagging in an admin UI is not the same as
  filing a SAR with a regulator within the legally required window.
- Beneficial ownership verification for business accounts.
- Being a licensed money transmitter (or partnering with a bank that is) in
  every state/country you operate in. Moving other people's money is
  regulated activity almost everywhere.
- Independent audits of the AML program, typically annually.

**Beyond PCI/KYC/AML**
- Deposit insurance disclosures (FDIC in the US) if this were ever
  presented as holding real deposits.
- SOC 2 (or equivalent) controls audit for the engineering org itself.
- A real incident response plan and breach notification process.
- Data residency and retention policy — this demo has no automatic
  purging/retention schedule for audit logs or KYC documents.

## Honest summary

This project demonstrates the *engineering patterns* real financial
institutions use — encryption at rest, tamper-evident logging, role
separation, transaction monitoring, a KYC workflow — well enough to be a
legitimate learning project or portfolio piece. It is not, and cannot
become, "compliant" through code alone. Compliance is a legal and
organizational status obtained through licensing, audits, and certified
processes, not a property of a codebase.
