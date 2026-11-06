# Meridian Bank — API Reference

Base URL in development: `http://localhost:5000` (the frontend talks to it via
the Vite dev proxy, so from the browser it's just `/api/...`).

## Conventions

**Every response** is shaped one of two ways:

```json
{"success": true,  "message": "...", "data": { ... }}
{"success": false, "message": "...", "errors": [ ... ]}
```

`data` is always an object (possibly empty `{}`). `errors` is a list of
strings — usually empty even on failure; populated for field-level
validation issues.

**Auth column values:**
- `none` — no auth required
- `access token` — requires a valid `access_token` cookie (sent automatically
  by the browser; set the header manually if calling from a script)
- `access token + CSRF` — also requires the `X-CSRF-Token` header, read from
  the non-httponly `csrf_token` cookie, on every state-changing request
- `admin` — requires `access token + CSRF` **and** the caller's `role` claim
  to be `admin`

CSRF tokens and cookies are explained in `README.md` → "Auth architecture."

---

## Auth

### `POST /api/auth/register`
Auth: none
Creates a user + a $0 checking account, logs them in immediately (no OTP —
this is the one auth endpoint that doesn't gate on a code, by design, for
instant account opening).

Request body:
```json
{"username": "andrew", "password": "min 8 chars", "full_name": "Smitten Andrew",
 "email": "andrew@example.com", "phone_number": "+15550101"}
```
Response `data`: `{"user": {...}, "csrf_token": "..."}`
Sets `access_token`, `refresh_token`, `csrf_token` cookies.

### `POST /api/auth/login`
Auth: none
Step 1 of 2. Checks the password, does **not** log the user in.

Request body: `{"username": "andrew", "password": "..."}`
Response `data`: `{"otp_token": "...", "masked_phone": "•••0101", "expires_in_seconds": 300}`
(also includes `"otp_debug": "123456"` when `ENV=development`)

Rate limited: 5 failed attempts locks the username out for 60s.

### `POST /api/auth/verify-otp`
Auth: none (requires the `otp_token` from step 1 instead)
Step 2 of 2. On success, sets real auth cookies.

Request body: `{"otp_token": "...", "code": "123456"}`
Response `data`: `{"user": {...}, "csrf_token": "..."}`

Fails with 401 after `OTP_MAX_ATTEMPTS` wrong codes or if the code expired
(`OTP_EXPIRY_MINUTES`, default 5).

### `POST /api/auth/resend-otp`
Auth: none (requires `otp_token`)
Request body: `{"otp_token": "..."}`
Response `data`: `{"expires_in_seconds": 300}` (+ `otp_debug` in dev)
Rate limited: `OTP_RESEND_COOLDOWN_SECONDS` (default 30) between resends.

### `POST /api/auth/refresh`
Auth: none (reads the `refresh_token` cookie)
Rotates the refresh token (old one revoked, new one issued) and issues a
fresh access token. Called automatically by the frontend on a 401 with
`errors: ["token_expired"]` — you don't need to call this yourself when
using the app normally.
Response `data`: `{}`

### `POST /api/auth/logout`
Auth: access token + CSRF
Revokes the current refresh token, clears all three cookies.
Response `data`: `{}`

### `GET /api/auth/me`
Auth: access token
Response `data`: `{"user": {"id", "username", "full_name", "email", "phone_number", "role", "kyc_status", ...}}`

---

## Accounts

### `GET /api/accounts`
Auth: access token
The caller's own accounts.
Response `data`: `{"accounts": [{"account_id", "account_type", "balance", "is_frozen"}, ...]}`

### `GET /api/accounts/<account_id>/transactions?limit=&offset=`
Auth: access token (must own the account, or be admin)
Response `data`: `{"transactions": [{...}, ...]}`

### `GET /api/accounts/lookup/<account_id>`
Auth: access token
Used by the transfer form to show "who am I sending to" before confirming.
Response `data`: `{"account_id", "holder_name", "account_type", "is_frozen"}`
404 if the account doesn't exist.

### `GET /api/dashboard/summary`
Auth: access token
Aggregate figures for the caller: total/available balance, this month's
income/spending, and a 6-month chart series. (Not currently rendered on the
simplified dashboard, but still available if you want it back.)

---

## Transfers

Transfers require **admin approval** — see README.md → "Transfers now
require admin approval" for the full flow. Nothing here moves money until an
admin approves it.

### `POST /api/otp/request`
Auth: access token + CSRF
Issues an OTP for the *next transfer* (separate from login OTP — has its own
`purpose="transfer"` record). Response `data`: `{"message": "..."}`  (+ `otp_debug` in dev)

### `POST /api/transfer`
Auth: access token + CSRF
Creates a **pending** transfer request — does not move money.

Request body:
```json
{"from_account": "...", "to_account": "...", "amount": 25.00, "otp": "123456", "description": "Rent"}
```
Response `data`: `{"pending": true, "reference": "TXN-...", "amount", "fee", "from_account", "to_account", "description", "timestamp"}`

Validation includes: OTP match, sufficient balance *minus* what's already
reserved by the caller's other pending requests, account not frozen,
recipient exists. AML checks run here too (large-amount / structuring),
setting `is_flagged` on the request for the admin queue.

### `GET /api/transfers/pending`
Auth: access token
The caller's own not-yet-approved requests (shown on the dashboard).
Response `data`: `{"transfers": [{"id", "reference", "from_account", "to_account", "amount", "description", "status", "is_flagged", "created_at"}, ...]}`

---

## Cards

### `GET /api/cards`
Auth: access token
Response `data`: `{"cards": [{"id", "account_id", "last4", "expiry", "card_type", "status", "is_virtual", "spending_limit"}, ...]}`

### `POST /api/cards/<id>/toggle-freeze`
Auth: access token + CSRF (must own the card)
Response `data`: `{"card_status": "active" | "frozen"}`

### `POST /api/cards/<id>/reveal`
Auth: access token + CSRF (must own the card)
Decrypts and returns the full card number + CVV. Audit-logged every time —
this is sensitive even in a demo.
Response `data`: `{"full_number", "cvv", "expiry"}`

### `POST /api/cards/<id>/limit`
Auth: access token + CSRF (must own the card)
Request body: `{"limit": 3000}`
Response `data`: `{"spending_limit": 3000.0}`

### `POST /api/cards/virtual`
Auth: access token + CSRF
Issues a second, virtual-only card for a checking account (one per account).
Request body: `{"account_id": "..."}`
Response `data`: `{"card": {...}}`

---

## Statements

All three accept the same optional filters as query params:
`?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&q=search+text`

### `GET /api/statements/<account_id>/preview`
Auth: access token (own account, or admin)
JSON, for the live-filtered table in the UI.
Response `data`: `{"transactions": [...]}`

### `GET /api/statements/<account_id>`
Auth: access token (own account, or admin)
Downloads a CSV file (not a JSON envelope — raw `text/csv`).

### `GET /api/statements/<account_id>/pdf`
Auth: access token (own account, or admin)
Downloads a formatted PDF statement (raw `application/pdf`), built with
reportlab.

---

## KYC

### `POST /api/kyc/submit`
Auth: access token + CSRF
Request body:
```json
{"legal_name", "date_of_birth": "YYYY-MM-DD", "id_type": "passport|drivers_license|national_id",
 "id_number", "address", "ssn_last4": "optional"}
```
Sets the caller's `kyc_status` to `pending`. Response `data`: `{}`

### `GET /api/kyc/status`
Auth: access token
Response `data`: `{"kyc_status": "...", "record": {...} | null}`

---

## Admin

Every route below additionally requires `role == "admin"`.

### `GET /api/admin/users`
All users with their accounts. `data`: `{"users": [{...with "accounts": [...]}]}`

### `POST /api/admin/accounts/<account_id>/toggle-freeze`
Requires CSRF. `data`: `{"is_frozen": true|false}`

### `GET /api/admin/transactions?limit=100`
Bank-wide completed transactions. `data`: `{"transactions": [...]}`

### `GET /api/admin/transactions/flagged`
Completed transactions still flagged and not cleared. `data`: `{"transactions": [...]}`

### `POST /api/admin/transactions/<id>/clear-flag`
Requires CSRF. `data`: `{}`

### `GET /api/admin/transfers/pending`
The approval queue. `data`: `{"transfers": [{"id", "reference", "from_account", "to_account", "amount", "description", "status", "is_flagged", "flag_reason", "created_at", "reviewed_by", "reviewed_at", "rejection_reason"}]}`

### `POST /api/admin/transfers/<id>/approve`
Requires CSRF. Re-validates funds/frozen status at approval time (can fail
even if it passed at request time, if the balance changed since). Executes
the actual ledger transaction on success.
`data`: `{}`  or  400 with a reason if re-validation fails.

### `POST /api/admin/transfers/<id>/reject`
Requires CSRF. Body: `{"reason": "..."}`. `data`: `{}`

### `GET /api/admin/kyc/pending`
Queue of submitted-but-not-reviewed KYC records, **with sensitive fields
revealed** (this is the one place `id_number`/`address`/`ssn_last4` come
back unmasked — reviewers need to actually see them).
`data`: `{"records": [...]}`

### `POST /api/admin/kyc/<id>/review`
Requires CSRF. Body: `{"decision": "verified"|"rejected", "reason": "..."}`
(`reason` only used when rejecting). `data`: `{}`

### `GET /api/admin/audit-log?limit=100`
`data`: `{"entries": [{"id", "timestamp", "action", "actor_username", "target", "success", "metadata", "ip_address"}, ...]}`

### `GET /api/admin/audit-log/verify`
Walks the hash chain end-to-end.
`data`: `{"chain_valid": true|false, "broken_at_id": null | <id>}`

### `GET /api/admin/analytics`
Aggregate stats for the Admin → Analytics tab.
`data`:
```json
{
  "total_customers": 2, "total_accounts": 4, "total_deposits": 18234.50,
  "accounts_by_type": {"checking": 2, "savings": 2},
  "kyc_breakdown": {"unverified": 0, "pending": 1, "verified": 1, "rejected": 0},
  "daily_volume": [{"date": "2026-09-01", "count": 3, "volume": 450.0}, ...],
  "flagged_open_count": 0,
  "pending_transfers_count": 1, "pending_transfers_volume": 250.0,
  "total_cards": 3, "frozen_cards": 0
}
```

---

## Error reference

| Status | Meaning |
|---|---|
| 400 | Bad request — missing/invalid fields, business rule violation (insufficient balance, etc.) |
| 401 | Not authenticated, or access token expired (`errors: ["token_expired"]` — frontend auto-retries via refresh) |
| 403 | Authenticated but not authorized (wrong role, missing/invalid CSRF token) |
| 404 | Resource not found (or exists but you don't own it — same response either way, so account enumeration doesn't leak ownership) |
| 409 | Conflict (username taken, virtual card already exists for that account) |
| 429 | Rate limited (login lockout, OTP resend cooldown, OTP max attempts) |
| 500 | Server error |
