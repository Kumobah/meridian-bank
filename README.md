# Meridian Bank (demo)

> ⚠️ **Demo only — not a real bank.** "Meridian Bank" is a fictional application
> built as a learning/portfolio project. It holds no real deposits, moves no real
> money, and is not affiliated with any real institution. See
> [`COMPLIANCE.md`](./COMPLIANCE.md) for an honest breakdown of what's simulated
> vs. what real PCI-DSS/KYC/AML compliance requires.

A full-stack banking demo: Flask + Postgres API and a React/Tailwind dashboard,
with a public marketing homepage in front of it. Hybrid JWT-in-cookie auth with
OTP required on every login, multi-account users, transaction history, cards,
CSV statements, KYC onboarding, AML transaction monitoring, and a tamper-evident
audit log.

This is a **lab/demo project** — read `COMPLIANCE.md` before assuming any of
this satisfies real PCI-DSS/KYC/AML obligations. It doesn't, and no amount of
solo coding makes it so.

## Project layout

```
secure_bank/
├── backend/                 Flask API (port 5000)
│   ├── app.py                 routes
│   ├── models.py               SQLAlchemy models (Postgres)
│   ├── config.py                env-driven config
│   ├── security.py               JWT, cookies, auth decorators, encryption
│   ├── responses.py               {success, message, data} response helpers
│   ├── audit.py                    hash-chained audit logging
│   ├── sms.py                       console / mock / Twilio provider
│   ├── aml.py                        large-txn + structuring detection
│   ├── seed.py                        demo data
│   ├── docker-compose.yml              local Postgres
│   ├── .env.example
│   └── requirements.txt
├── frontend/                 React + Vite + Tailwind (port 5173)
│   └── src/
│       ├── pages/Landing.jsx    public homepage
│       ├── pages/Login.jsx       step 1: password
│       ├── pages/VerifyOtp.jsx    step 2: OTP
│       └── ...                     dashboard, transfers, cards, admin, etc.
├── README.md
└── COMPLIANCE.md
```

## 1. Start Postgres

```bash
cd backend
docker compose up -d
```

## 2. Configure the backend

```bash
cd backend
cp .env.example .env
```

Generate the two required secrets and paste them into `.env`:

```bash
python -c "import secrets; print(secrets.token_hex(32))"                        # JWT_SECRET
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"  # FIELD_ENCRYPTION_KEY
```

Both are required — the app refuses to start without them. `JWT_SECRET` signs
every access/refresh token; losing or changing it invalidates every logged-in
session (not a big deal in dev, just log in again). `FIELD_ENCRYPTION_KEY`
encrypts PII at rest, so losing/changing it makes existing encrypted data
unreadable.

Everything else in `.env.example` has sane defaults for local dev — leave
`SMS_PROVIDER=console` and `ENV=development` unless you're testing something
specific.

## 3. Run the backend

```bash
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
flask --app app init-db         # creates tables + seeds demo data (first run only)
python app.py
```

## 4. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. `/` is the public homepage; `/login` and
`/signup` are open to anyone; everything else requires auth.

## 5. Log in

The homepage → "Login Securely" takes you to a two-step flow: password, then
a 6-digit code. In development the code is printed to the **backend
terminal** AND returned in the API response (visible in the browser
console) so you don't have to alt-tab every time.

The login/sign-up screens no longer show demo credentials on-screen (kept
clean, like a real product would be) — here's the actual list:

| Full name      | Username | Password    | Role  | KYC status |
|----------------|----------|-------------|-------|------------|
| Smitten Andrew | andrew   | Andrew#2026 | user  | verified   |
| Felix Wagner   | felix    | Felix#2026  | user  | pending (in review queue) |
| Bank Administrator | admin | admin123   | admin | verified   |

## Auth architecture

Hybrid JWT-in-httponly-cookie, not classic localStorage JWT:

- **Access token** (15 min default): httponly cookie, decoded per-request to
  identify the user. Never touches JS, so an XSS bug can't read it the way it
  could read a localStorage token.
- **Refresh token** (7 days default): httponly cookie scoped to `/api/auth`
  only, tracked in a `refresh_tokens` table so it can actually be revoked on
  logout, and rotated (old one revoked, new one issued) on every use.
- **CSRF token**: generated once per login, embedded as a claim in both JWTs,
  and *also* set as a third, deliberately non-httponly cookie so the page's
  own JS can read it and echo it back as an `X-CSRF-Token` header on every
  mutating request. The server checks that header against the claim it
  decoded from the (JS-unreadable) access token cookie — standard
  double-submit CSRF, adapted for JWT-in-cookie.
- The frontend's `api.js` silently retries once via `/api/auth/refresh` if a
  request comes back with an expired access token, so a 15-minute token
  lifetime doesn't mean getting logged out every 15 minutes.

## OTP flow

Every login (not just transfers) now requires a 6-digit code:

1. `POST /api/auth/login` — checks the password, returns a short-lived
   `otp_token` (not a real session) plus a masked phone number.
2. `POST /api/auth/verify-otp` — checks the code against that `otp_token`.
   On success, sets the real auth cookies.
3. `POST /api/auth/resend-otp` — rate-limited (30s cooldown by default).

Codes expire after 5 minutes and lock out after 5 wrong attempts (both
configurable in `.env`). The SMS delivery layer is pluggable —
`SMS_PROVIDER=console` (default), `mock`, or `twilio` — swapping providers is
a one-line env change, not a code change.

## Transfers now require admin approval

No transfer moves money on submission anymore. The flow is:

1. User submits a transfer (still gated by its own OTP, separate from login
   OTP) — this creates a `TransferRequest` row with `status=pending`.
   Balances are untouched. The user sees a "pending" receipt, and the
   request also shows up in a **Pending transfers** panel on their dashboard.
2. An admin reviews it from **Admin panel → Pending transfers**
   (`GET /api/admin/transfers/pending`) and either:
   - **Approves** (`POST /api/admin/transfers/<id>/approve`) — balances and
     re-validated at approval time (frozen status, sufficient funds can
     change between request and approval), then the two ledger `Transaction`
     rows are created exactly as the old immediate-execution flow did.
   - **Rejects** (`POST /api/admin/transfers/<id>/reject`), with a reason —
     nothing moves, the requester's balance is untouched.
3. A user can't over-commit funds across multiple pending requests: the
   amount already reserved by their other pending requests is checked
   against their balance before a new request is accepted.

AML structuring detection (see `aml.py`) was updated to look at
`TransferRequest` history rather than completed transactions — otherwise a
burst of pending (not-yet-approved) requests just under the reporting
threshold would never trip the check.

## Response format

Every endpoint returns:
```json
{"success": true, "message": "...", "data": {...}}
{"success": false, "message": "...", "errors": [...]}
```

See **`API_DOCS.md`** for every endpoint — method, auth requirements,
request body, and response shape.

## What's actually implemented

See `COMPLIANCE.md` for the full breakdown — short version: hashed
passwords, encrypted PII at rest, CSRF protection, OTP-gated login, login
rate limiting, role-based access control, a tamper-evident audit trail, a
KYC review workflow, and basic AML transaction-monitoring rules.

## Running this persistently (systemd + nginx + self-hosted git)

The setup above is for active development. If you want this running in the
background without a terminal open, plus version control on a self-hosted
Gitea instance instead of GitHub, see **`deploy/README.md`**.

## What this is *not*

Not a licensed money transmitter, not PCI-DSS certified, not running a real
AML program. `COMPLIANCE.md` spells out exactly what's simulated here versus
what real compliance would require.
