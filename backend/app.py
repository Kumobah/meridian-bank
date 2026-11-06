"""
Meridian Bank - Backend API (v3)
==================================
Auth: hybrid JWT-in-httponly-cookie, OTP required on every login (see
security.py for the full design rationale). Postgres via SQLAlchemy,
pluggable SMS provider, hash-chained audit logging, KYC/AML controls.

Run with:
    flask --app app init-db     # create tables + seed demo data (first run only)
    python app.py                # or: flask --app app run

See README.md and COMPLIANCE.md for what this does and doesn't cover.
"""

import io
import csv
import re
import random
import secrets
import os
from decimal import Decimal, InvalidOperation
from datetime import date, datetime, timezone, timedelta

import jwt as pyjwt
from flask import Flask, request, g
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash

from config import Config
from extensions import db
from responses import ok, fail
from security import (
    jwt_required, admin_required, csrf_protected,
    is_locked_out, register_failed_login, clear_login_attempts,
    new_csrf_token, new_otp_code, hash_otp,
    create_pending_otp_token, create_access_token, create_refresh_token,
    set_auth_cookies, clear_auth_cookies, decode_token,
)
from models import User, Account, Transaction, Card, ActiveOTP, KYCRecord, AuditLog, RefreshToken, TransferRequest, now_iso
from audit import log_event, verify_chain
from sms import get_sms_provider
from aml import evaluate_transaction
from utils import generate_account_number


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    if not app.config["FIELD_ENCRYPTION_KEY"]:
        raise SystemExit(
            "\nFIELD_ENCRYPTION_KEY is not set. Generate one with:\n"
            "  python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"\n"
        )
    if not app.config["JWT_SECRET"]:
        raise SystemExit(
            "\nJWT_SECRET is not set. Generate one with:\n"
            "  python -c \"import secrets; print(secrets.token_hex(32))\"\n"
        )

    db.init_app(app)
    CORS(app, supports_credentials=True, origins=app.config["CORS_ORIGINS"])

    @app.after_request
    def set_security_headers(resp):
        resp.headers["X-Content-Type-Options"] = "nosniff"
        resp.headers["X-Frame-Options"] = "DENY"
        resp.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if app.config["COOKIE_SECURE"]:
            resp.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        return resp

    @app.errorhandler(404)
    def not_found(e):
        return fail("Not found.", status=404)

    @app.errorhandler(500)
    def server_error(e):
        return fail("Internal server error.", status=500)

    @app.cli.command("init-db")
    def init_db_command():
        from seed import seed_if_empty
        db.create_all()
        seed_if_empty()
        print("[*] Database ready.")

    register_routes(app)
    return app


def register_routes(app):

    def owns_account(user_id, account_id):
        return Account.query.filter_by(account_id=account_id, user_id=user_id).first() is not None

    def issue_otp(user, purpose):
        """Generates, stores (hashed), and delivers an OTP. Returns the raw
        code only when ENV=development, so callers can echo it in dev responses."""
        code = new_otp_code()
        expiry_minutes = app.config["OTP_EXPIRY_MINUTES"]
        expires_at = (datetime.now(timezone.utc) + timedelta(minutes=expiry_minutes)).isoformat()

        existing = ActiveOTP.query.get(user.id)
        if existing:
            existing.otp_hash = hash_otp(code)
            existing.purpose = purpose
            existing.created_at = now_iso()
            existing.expires_at = expires_at
            existing.attempts = 0
            existing.is_verified = False
        else:
            db.session.add(ActiveOTP(
                user_id=user.id, otp_hash=hash_otp(code), purpose=purpose,
                created_at=now_iso(), expires_at=expires_at, attempts=0,
            ))
        db.session.commit()

        provider = get_sms_provider()
        delivery = provider.send(user.phone_number or "(no phone on file)", code)

        # Guaranteed-visible fallback for local dev: regardless of SMS_PROVIDER
        # or whether stdout is going to a terminal, journald, or nowhere you
        # can easily see, this file always gets the code. `tail -f` it.
        # Never runs outside development - this is a dev convenience, not a
        # production logging path.
        if app.config["ENV"] == "development":
            try:
                otp_log_path = os.path.join(os.path.dirname(__file__), "logs", "otp_debug.log")
                os.makedirs(os.path.dirname(otp_log_path), exist_ok=True)
                with open(otp_log_path, "a") as f:
                    f.write(f"{now_iso()}  user={user.username}  purpose={purpose}  code={code}\n")
            except OSError:
                pass  # never let a logging convenience break the actual OTP flow

        debug_code = code if app.config["ENV"] == "development" else None
        return delivery, debug_code

    # ── Registration (instant - no OTP gate, matches "open an account in
    #    seconds" positioning; every subsequent LOGIN still requires OTP) ────
    @app.route("/api/auth/register", methods=["POST"])
    def register():
        data = request.get_json(silent=True) or {}
        username = (data.get("username") or "").strip().lower()
        password = data.get("password") or ""
        full_name = (data.get("full_name") or "").strip()
        email = (data.get("email") or "").strip()
        phone = (data.get("phone_number") or "").strip()

        if not username or not password or not full_name:
            return fail("Username, password, and full name are required.")
        if not re.match(r"^[a-zA-Z0-9_.]{3,32}$", username):
            return fail("Username must be 3-32 characters (letters, numbers, . or _ only).")
        if len(password) < 8:
            return fail("Password must be at least 8 characters.")
        if User.query.filter_by(username=username).first():
            return fail("That username is already taken.", status=409)

        user = User(username=username, password_hash=generate_password_hash(password),
                    full_name=full_name, role="user", kyc_status="unverified", created_at=now_iso())
        user.email = email or None
        user.phone_number = phone or None
        db.session.add(user)
        db.session.flush()

        candidate = generate_account_number(lambda c: Account.query.get(c) is not None)
        db.session.add(Account(account_id=candidate, user_id=user.id, account_type="checking",
                                balance=Decimal("0.00"), created_at=now_iso()))
        db.session.commit()

        csrf_token = new_csrf_token()
        access_token = create_access_token(user.id, user.role, csrf_token)
        jti = new_csrf_token()
        refresh_token = create_refresh_token(user.id, csrf_token, jti)
        refresh_expires = (datetime.now(timezone.utc) + timedelta(days=app.config["REFRESH_TOKEN_EXPIRY_DAYS"])).isoformat()
        db.session.add(RefreshToken(jti=jti, user_id=user.id, expires_at=refresh_expires))
        db.session.commit()

        log_event("account_registered", actor_username=username, actor_id=user.id, target=candidate)

        resp = ok({"user": user.to_dict(), "csrf_token": csrf_token}, "Account created.", status=201)
        return set_auth_cookies(resp, access_token, refresh_token, csrf_token)

    # ── Login (step 1 of 2: password check -> OTP) ──────────────────────────
    @app.route("/api/auth/login", methods=["POST"])
    def login():
        data = request.get_json(silent=True) or {}
        username = (data.get("username") or "").strip().lower()
        password = data.get("password") or ""

        if not username or not password:
            return fail("Username and password are required.")

        if is_locked_out(username):
            log_event("login_blocked_lockout", actor_username=username, success=False)
            return fail("Too many failed attempts. Try again in a minute.", status=429)

        user = User.query.filter_by(username=username).first()

        if not user or not check_password_hash(user.password_hash, password):
            register_failed_login(username)
            log_event("login_failed", actor_username=username, success=False)
            return fail("Invalid username or password.", status=401)

        clear_login_attempts(username)

        delivery, debug_code = issue_otp(user, purpose="login")
        pending_token = create_pending_otp_token(user.id)

        log_event("login_password_verified", actor_username=username, actor_id=user.id,
                   metadata={"delivery_channel": delivery.get("channel")})

        masked_phone = _mask_phone(user.phone_number)
        payload = {
            "otp_token": pending_token,
            "masked_phone": masked_phone,
            "expires_in_seconds": app.config["OTP_EXPIRY_MINUTES"] * 60,
        }
        if debug_code:
            payload["otp_debug"] = debug_code

        return ok(payload, "Verification code sent.")

    # ── OTP verify (step 2 of 2: issues real tokens) ────────────────────────
    @app.route("/api/auth/verify-otp", methods=["POST"])
    def verify_otp():
        data = request.get_json(silent=True) or {}
        pending_token = data.get("otp_token") or ""
        code = (data.get("code") or "").strip()

        try:
            payload = decode_token(pending_token)
        except pyjwt.ExpiredSignatureError:
            return fail("Your session expired. Please log in again.", status=401)
        except pyjwt.InvalidTokenError:
            return fail("Invalid session. Please log in again.", status=401)

        if payload.get("type") != "pending_otp":
            return fail("Invalid session. Please log in again.", status=401)

        user_id = int(payload["sub"])
        user = User.query.get(user_id)
        if not user:
            return fail("Account not found.", status=404)

        otp = ActiveOTP.query.get(user_id)
        if not otp or otp.purpose != "login":
            return fail("No verification code is pending. Please log in again.", status=400)

        if otp.is_expired():
            db.session.delete(otp)
            db.session.commit()
            return fail("Verification code expired. Please log in again.", status=401)

        if otp.attempts >= app.config["OTP_MAX_ATTEMPTS"]:
            db.session.delete(otp)
            db.session.commit()
            log_event("otp_locked_out", actor_id=user_id, success=False)
            return fail("Too many incorrect attempts. Please log in again.", status=429)

        if not otp.matches(code):
            otp.attempts += 1
            db.session.commit()
            remaining = app.config["OTP_MAX_ATTEMPTS"] - otp.attempts
            log_event("otp_failed", actor_id=user_id, success=False, metadata={"remaining_attempts": remaining})
            return fail(f"Incorrect code. {remaining} attempt(s) remaining.", status=401)

        db.session.delete(otp)

        csrf_token = new_csrf_token()
        access_token = create_access_token(user.id, user.role, csrf_token)
        jti = new_csrf_token()
        refresh_expires = (datetime.now(timezone.utc) + timedelta(days=app.config["REFRESH_TOKEN_EXPIRY_DAYS"])).isoformat()
        refresh_token = create_refresh_token(user.id, csrf_token, jti)
        db.session.add(RefreshToken(jti=jti, user_id=user.id, expires_at=refresh_expires))
        db.session.commit()

        log_event("login_success", actor_username=user.username, actor_id=user.id)

        resp = ok({"user": user.to_dict(), "csrf_token": csrf_token}, "Login successful.")
        return set_auth_cookies(resp, access_token, refresh_token, csrf_token)

    @app.route("/api/auth/resend-otp", methods=["POST"])
    def resend_otp():
        data = request.get_json(silent=True) or {}
        pending_token = data.get("otp_token") or ""

        try:
            payload = decode_token(pending_token)
        except pyjwt.PyJWTError:
            return fail("Invalid session. Please log in again.", status=401)
        if payload.get("type") != "pending_otp":
            return fail("Invalid session. Please log in again.", status=401)

        user_id = int(payload["sub"])
        user = User.query.get(user_id)
        if not user:
            return fail("Account not found.", status=404)

        existing = ActiveOTP.query.get(user_id)
        if existing:
            elapsed = (datetime.now(timezone.utc) - datetime.fromisoformat(existing.created_at)).total_seconds()
            cooldown = app.config["OTP_RESEND_COOLDOWN_SECONDS"]
            if elapsed < cooldown:
                return fail(f"Please wait {int(cooldown - elapsed)}s before requesting another code.", status=429)

        delivery, debug_code = issue_otp(user, purpose="login")
        log_event("otp_resent", actor_id=user_id, metadata={"delivery_channel": delivery.get("channel")})

        payload_out = {"expires_in_seconds": app.config["OTP_EXPIRY_MINUTES"] * 60}
        if debug_code:
            payload_out["otp_debug"] = debug_code
        return ok(payload_out, "A new code was sent.")

    @app.route("/api/auth/refresh", methods=["POST"])
    def refresh():
        token = request.cookies.get(app.config["REFRESH_COOKIE_NAME"])
        if not token:
            return fail("No refresh token.", status=401)

        try:
            payload = decode_token(token)
        except pyjwt.PyJWTError:
            resp = fail("Refresh token invalid or expired.", status=401)
            return clear_auth_cookies(resp)

        if payload.get("type") != "refresh":
            resp = fail("Refresh token invalid.", status=401)
            return clear_auth_cookies(resp)

        record = RefreshToken.query.filter_by(jti=payload["jti"]).first()
        if not record or record.revoked or datetime.fromisoformat(record.expires_at) < datetime.now(timezone.utc):
            resp = fail("Refresh token invalid or expired.", status=401)
            return clear_auth_cookies(resp)

        user = User.query.get(int(payload["sub"]))
        if not user:
            resp = fail("Account not found.", status=401)
            return clear_auth_cookies(resp)

        # rotate: revoke the used refresh token, issue a fresh pair
        record.revoked = True
        csrf_token = payload["csrf"]  # keep stable across refresh so the frontend doesn't need to update it
        new_jti = new_csrf_token()
        new_expires = (datetime.now(timezone.utc) + timedelta(days=app.config["REFRESH_TOKEN_EXPIRY_DAYS"])).isoformat()
        db.session.add(RefreshToken(jti=new_jti, user_id=user.id, expires_at=new_expires))
        db.session.commit()

        access_token = create_access_token(user.id, user.role, csrf_token)
        new_refresh_token = create_refresh_token(user.id, csrf_token, new_jti)

        resp = ok({}, "Token refreshed.")
        return set_auth_cookies(resp, access_token, new_refresh_token, csrf_token)

    @app.route("/api/auth/logout", methods=["POST"])
    @jwt_required
    @csrf_protected
    def logout():
        token = request.cookies.get(app.config["REFRESH_COOKIE_NAME"])
        if token:
            try:
                payload = decode_token(token)
                if payload.get("type") == "refresh":
                    record = RefreshToken.query.filter_by(jti=payload["jti"]).first()
                    if record:
                        record.revoked = True
                        db.session.commit()
            except pyjwt.PyJWTError:
                pass

        log_event("logout", actor_id=g.user_id)
        resp = ok({}, "Logged out.")
        return clear_auth_cookies(resp)

    @app.route("/api/auth/me", methods=["GET"])
    @jwt_required
    def me():
        user = User.query.get(g.user_id)
        if not user:
            return fail("Unauthorized.", status=401)
        return ok({"user": user.to_dict()})

    # ── Accounts ─────────────────────────────────────────────────────────
    @app.route("/api/accounts", methods=["GET"])
    @jwt_required
    def list_accounts():
        rows = Account.query.filter_by(user_id=g.user_id).order_by(Account.account_type).all()
        return ok({"accounts": [a.to_dict() for a in rows]})

    @app.route("/api/accounts/<account_id>/transactions", methods=["GET"])
    @jwt_required
    def account_transactions(account_id):
        if not owns_account(g.user_id, account_id) and g.role != "admin":
            return fail("Not found.", status=404)

        limit = min(int(request.args.get("limit", 50)), 200)
        offset = max(int(request.args.get("offset", 0)), 0)
        rows = (Transaction.query.filter_by(account_id=account_id)
                .order_by(Transaction.id.desc()).limit(limit).offset(offset).all())
        return ok({"transactions": [t.to_dict() for t in rows]})

    @app.route("/api/accounts/lookup/<account_id>", methods=["GET"])
    @jwt_required
    def lookup_account(account_id):
        """Recipient lookup for the transfer form - confirms an account
        exists and shows whose it is before the sender commits to a transfer."""
        account = Account.query.get(account_id)
        if not account:
            return fail("Account not found.", status=404)
        owner = User.query.get(account.user_id)
        return ok({
            "account_id": account.account_id,
            "account_type": account.account_type,
            "holder_name": owner.full_name if owner else "Unknown",
            "is_frozen": account.is_frozen,
        })

    @app.route("/api/dashboard/summary", methods=["GET"])
    @jwt_required
    def dashboard_summary():
        accounts = Account.query.filter_by(user_id=g.user_id).all()
        account_ids = [a.account_id for a in accounts]

        total_balance = sum((a.balance for a in accounts), Decimal("0"))
        available_balance = sum((a.balance for a in accounts if not a.is_frozen), Decimal("0"))

        if not account_ids:
            return ok({
                "total_balance": 0.0, "available_balance": 0.0,
                "monthly_spending": 0.0, "monthly_income": 0.0, "chart": [],
            })

        now = datetime.now(timezone.utc)
        six_months_ago = (now.replace(day=1) - timedelta(days=150)).replace(day=1)
        rows = (Transaction.query.filter(Transaction.account_id.in_(account_ids),
                                          Transaction.timestamp >= six_months_ago.isoformat())
                .all())

        month_buckets = {}  # "YYYY-MM" -> {"income": Decimal, "spending": Decimal}
        monthly_spending = Decimal("0")
        monthly_income = Decimal("0")
        current_month_key = now.strftime("%Y-%m")

        for t in rows:
            ts = datetime.fromisoformat(t.timestamp)
            key = ts.strftime("%Y-%m")
            bucket = month_buckets.setdefault(key, {"income": Decimal("0"), "spending": Decimal("0")})
            if t.type in ("transfer_in", "deposit"):
                bucket["income"] += t.amount
                if key == current_month_key:
                    monthly_income += t.amount
            elif t.type in ("transfer_out", "withdrawal"):
                bucket["spending"] += t.amount
                if key == current_month_key:
                    monthly_spending += t.amount

        chart = []
        for i in range(5, -1, -1):
            month_dt = (now.replace(day=1) - timedelta(days=i * 30)).replace(day=1)
            key = month_dt.strftime("%Y-%m")
            bucket = month_buckets.get(key, {"income": Decimal("0"), "spending": Decimal("0")})
            chart.append({
                "month": month_dt.strftime("%b"),
                "income": float(bucket["income"]),
                "spending": float(bucket["spending"]),
            })

        return ok({
            "total_balance": float(total_balance),
            "available_balance": float(available_balance),
            "monthly_spending": float(monthly_spending),
            "monthly_income": float(monthly_income),
            "chart": chart,
        })

    # ── Transfer OTP (separate purpose from login OTP) ──────────────────────
    @app.route("/api/otp/request", methods=["POST"])
    @jwt_required
    @csrf_protected
    def request_transfer_otp():
        user = User.query.get(g.user_id)
        delivery, debug_code = issue_otp(user, purpose="transfer")
        log_event("otp_requested", actor_username=user.username, actor_id=user.id,
                   metadata={"delivery_channel": delivery.get("channel"), "purpose": "transfer"})

        channel_msg = "texted to your phone" if delivery.get("delivered") else "printed to the server console (dev mode)"
        payload = {"message": f"Verification code {channel_msg}."}
        if debug_code:
            payload["otp_debug"] = debug_code
        return ok(payload, payload["message"])

    # ── Transfers ────────────────────────────────────────────────────────
    def _execute_transfer_request(tr):
        """Actually moves money for an approved TransferRequest. Re-validates
        everything at approval time (balances/frozen status may have changed
        since the request was submitted) rather than trusting the original
        request blindly."""
        sender = Account.query.get(tr.from_account)
        recipient = Account.query.get(tr.to_account)

        if not sender or not recipient:
            return False, "One of the accounts no longer exists."
        if sender.is_frozen:
            return False, "Sender account is now frozen."
        if sender.balance < tr.amount:
            return False, "Sender no longer has sufficient balance."

        sender.balance -= tr.amount
        recipient.balance += tr.amount
        ts = now_iso()

        db.session.add(Transaction(
            account_id=tr.from_account, type="transfer_out", amount=tr.amount,
            counterparty_account=tr.to_account, description=tr.description,
            balance_after=sender.balance, timestamp=ts, is_flagged=tr.is_flagged, flag_reason=tr.flag_reason,
        ))
        db.session.add(Transaction(
            account_id=tr.to_account, type="transfer_in", amount=tr.amount,
            counterparty_account=tr.from_account, description=tr.description,
            balance_after=recipient.balance, timestamp=ts,
        ))
        return True, None

    @app.route("/api/transfer", methods=["POST"])
    @jwt_required
    @csrf_protected
    def execute_transfer():
        data = request.get_json(silent=True) or {}
        from_account = data.get("from_account")
        to_account = data.get("to_account")
        otp_input = data.get("otp") or ""
        description = (data.get("description") or "Transfer")[:140]
        user_id = g.user_id

        try:
            amount = Decimal(str(data.get("amount"))).quantize(Decimal("0.01"))
        except (InvalidOperation, TypeError):
            return fail("Invalid amount.")

        if not owns_account(user_id, from_account):
            log_event("transfer_denied", actor_id=user_id, target=from_account, success=False,
                       metadata={"reason": "not_owner"})
            return fail("You don't have access to that account.", status=403)

        otp = ActiveOTP.query.get(user_id)
        if not otp or otp.purpose != "transfer" or otp.is_expired() or not otp.matches(otp_input):
            log_event("transfer_denied", actor_id=user_id, target=from_account, success=False,
                       metadata={"reason": "bad_otp"})
            return fail("OTP verification failed.", status=401)

        sender = Account.query.get(from_account)
        recipient = Account.query.get(to_account)

        if not recipient:
            return fail("Recipient account not found.", status=404)
        if to_account == from_account:
            return fail("Cannot transfer to the same account.")
        if amount <= 0:
            return fail("Amount must be greater than zero.")
        if sender.is_frozen:
            log_event("transfer_denied", actor_id=user_id, target=from_account, success=False,
                       metadata={"reason": "account_frozen"})
            return fail("This account is frozen.")

        already_reserved = (db.session.query(db.func.coalesce(db.func.sum(TransferRequest.amount), 0))
                             .filter(TransferRequest.from_account == from_account,
                                     TransferRequest.status == "pending").scalar())
        if sender.balance < (Decimal(str(already_reserved)) + amount):
            return fail(
                f"Insufficient available balance — ${float(already_reserved):,.2f} is already reserved "
                f"by other pending transfer requests on this account."
            )

        is_flagged, flag_reason = evaluate_transaction(db.session, from_account, amount)

        reference = f"TXN-{secrets.token_hex(5).upper()}"
        ts = now_iso()
        tr = TransferRequest(
            reference=reference, from_account=from_account, to_account=to_account,
            amount=amount, description=description, requested_by=user_id,
            status="pending", is_flagged=is_flagged, flag_reason=flag_reason, created_at=ts,
        )
        db.session.add(tr)
        db.session.delete(otp)
        db.session.commit()

        log_event("transfer_requested", actor_id=user_id, target=from_account,
                   metadata={"to": to_account, "amount": str(amount), "reference": reference,
                             "flagged": is_flagged, "flag_reason": flag_reason})

        message = f"Transfer of ${amount:,.2f} submitted for admin approval."

        return ok({
            "pending": True,
            "reference": reference,
            "fee": 0.0,
            "amount": float(amount),
            "from_account": from_account,
            "to_account": to_account,
            "description": description,
            "timestamp": ts,
        }, message)

    @app.route("/api/transfers/pending", methods=["GET"])
    @jwt_required
    def my_pending_transfers():
        rows = (TransferRequest.query.filter_by(requested_by=g.user_id, status="pending")
                .order_by(TransferRequest.created_at.desc()).all())
        return ok({"transfers": [t.to_dict() for t in rows]})

    @app.route("/api/admin/transfers/pending", methods=["GET"])
    @jwt_required
    @admin_required
    def admin_pending_transfers():
        rows = TransferRequest.query.filter_by(status="pending").order_by(TransferRequest.created_at.asc()).all()
        return ok({"transfers": [t.to_dict() for t in rows]})

    @app.route("/api/admin/transfers/<int:transfer_id>/approve", methods=["POST"])
    @jwt_required
    @admin_required
    @csrf_protected
    def admin_approve_transfer(transfer_id):
        tr = TransferRequest.query.get(transfer_id)
        if not tr or tr.status != "pending":
            return fail("Transfer request not found or already reviewed.", status=404)

        success, error = _execute_transfer_request(tr)
        if not success:
            return fail(error)

        admin_user = User.query.get(g.user_id)
        tr.status = "approved"
        tr.reviewed_by = admin_user.username
        tr.reviewed_at = now_iso()
        db.session.commit()

        log_event("transfer_approved", actor_id=admin_user.id, actor_username=admin_user.username,
                   target=tr.reference, metadata={"amount": str(tr.amount)})
        return ok({}, "Transfer approved and executed.")

    @app.route("/api/admin/transfers/<int:transfer_id>/reject", methods=["POST"])
    @jwt_required
    @admin_required
    @csrf_protected
    def admin_reject_transfer(transfer_id):
        tr = TransferRequest.query.get(transfer_id)
        if not tr or tr.status != "pending":
            return fail("Transfer request not found or already reviewed.", status=404)

        data = request.get_json(silent=True) or {}
        admin_user = User.query.get(g.user_id)
        tr.status = "rejected"
        tr.reviewed_by = admin_user.username
        tr.reviewed_at = now_iso()
        tr.rejection_reason = data.get("reason", "Not specified")
        db.session.commit()

        log_event("transfer_rejected", actor_id=admin_user.id, actor_username=admin_user.username,
                   target=tr.reference, metadata={"reason": tr.rejection_reason})
        return ok({}, "Transfer rejected.")

    # ── Cards ────────────────────────────────────────────────────────────
    @app.route("/api/cards", methods=["GET"])
    @jwt_required
    def list_cards():
        rows = (Card.query.join(Account, Card.account_id == Account.account_id)
                .filter(Account.user_id == g.user_id).all())
        return ok({"cards": [c.to_dict() for c in rows]})

    @app.route("/api/cards/<int:card_id>/toggle-freeze", methods=["POST"])
    @jwt_required
    @csrf_protected
    def toggle_card_freeze(card_id):
        card = (Card.query.join(Account, Card.account_id == Account.account_id)
                .filter(Card.id == card_id, Account.user_id == g.user_id).first())
        if not card:
            return fail("Card not found.", status=404)

        card.status = "frozen" if card.status == "active" else "active"
        db.session.commit()
        log_event("card_freeze_toggled", actor_id=g.user_id, target=str(card_id),
                   metadata={"new_status": card.status})
        return ok({"card_status": card.status})

    @app.route("/api/cards/<int:card_id>/reveal", methods=["POST"])
    @jwt_required
    @csrf_protected
    def reveal_card(card_id):
        card = (Card.query.join(Account, Card.account_id == Account.account_id)
                .filter(Card.id == card_id, Account.user_id == g.user_id).first())
        if not card:
            return fail("Card not found.", status=404)

        # Revealing a full PAN is sensitive even in a demo - audit it like any
        # other access to sensitive data, not just mutations.
        log_event("card_number_revealed", actor_id=g.user_id, target=str(card_id))
        return ok({"full_number": card.full_number, "cvv": card.cvv, "expiry": card.expiry})

    @app.route("/api/cards/<int:card_id>/limit", methods=["POST"])
    @jwt_required
    @csrf_protected
    def set_card_limit(card_id):
        card = (Card.query.join(Account, Card.account_id == Account.account_id)
                .filter(Card.id == card_id, Account.user_id == g.user_id).first())
        if not card:
            return fail("Card not found.", status=404)

        data = request.get_json(silent=True) or {}
        try:
            limit = Decimal(str(data.get("limit"))).quantize(Decimal("0.01"))
        except (InvalidOperation, TypeError):
            return fail("Invalid limit.")
        if limit < 0 or limit > Decimal("1000000"):
            return fail("Limit must be between 0 and 1,000,000.")

        card.spending_limit = limit
        db.session.commit()
        log_event("card_limit_updated", actor_id=g.user_id, target=str(card_id),
                   metadata={"new_limit": str(limit)})
        return ok({"spending_limit": float(card.spending_limit)})

    @app.route("/api/cards/virtual", methods=["POST"])
    @jwt_required
    @csrf_protected
    def create_virtual_card():
        data = request.get_json(silent=True) or {}
        account_id = data.get("account_id")
        if not owns_account(g.user_id, account_id):
            return fail("You don't have access to that account.", status=403)

        existing_virtual = Card.query.filter_by(account_id=account_id, is_virtual=True).first()
        if existing_virtual:
            return fail("This account already has a virtual card.", status=409)

        last4 = f"{random.randint(1000, 9999)}"
        card = Card(account_id=account_id, last4=last4, expiry="12/29", card_type="debit",
                     status="active", is_virtual=True, spending_limit=Decimal("2000"))
        card.full_number = f"4242{random.randint(1000, 9999)}{last4}"  # distinct test BIN from physical cards
        card.cvv = f"{random.randint(100, 999)}"
        db.session.add(card)
        db.session.commit()

        log_event("virtual_card_created", actor_id=g.user_id, target=str(card.id))
        return ok({"card": card.to_dict()}, "Virtual card created.")

    # ── Statements ───────────────────────────────────────────────────────
    def filtered_transactions(account_id, args):
        query = Transaction.query.filter_by(account_id=account_id)

        start_date = args.get("start_date")
        end_date = args.get("end_date")
        if start_date:
            query = query.filter(Transaction.timestamp >= start_date)
        if end_date:
            # end_date is a plain YYYY-MM-DD; make it inclusive of the whole day
            query = query.filter(Transaction.timestamp <= end_date + "T23:59:59+00:00")

        rows = query.order_by(Transaction.id.asc()).all()

        q = (args.get("q") or "").strip().lower()
        if q:
            rows = [
                r for r in rows
                if q in (r.description or "").lower()
                or q in (r.counterparty_account or "").lower()
                or q in r.type.lower()
            ]
        return rows

    @app.route("/api/statements/<account_id>/preview", methods=["GET"])
    @jwt_required
    def statement_preview(account_id):
        if not owns_account(g.user_id, account_id) and g.role != "admin":
            return fail("Not found.", status=404)
        rows = filtered_transactions(account_id, request.args)
        return ok({"transactions": [t.to_dict() for t in rows]})

    @app.route("/api/statements/<account_id>", methods=["GET"])
    @jwt_required
    def download_statement(account_id):
        from flask import Response
        if not owns_account(g.user_id, account_id) and g.role != "admin":
            return fail("Not found.", status=404)

        rows = filtered_transactions(account_id, request.args)

        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(["Date", "Type", "Amount", "Counterparty", "Description", "Balance After"])
        for r in rows:
            writer.writerow([r.timestamp, r.type, f"{r.amount:.2f}", r.counterparty_account or "",
                              r.description or "", f"{r.balance_after:.2f}"])

        log_event("statement_downloaded", actor_id=g.user_id, target=account_id, metadata={"format": "csv"})

        return Response(
            buffer.getvalue(), mimetype="text/csv",
            headers={"Content-Disposition": f"attachment; filename=statement_{account_id}.csv"},
        )

    @app.route("/api/statements/<account_id>/pdf", methods=["GET"])
    @jwt_required
    def download_statement_pdf(account_id):
        from flask import Response
        from reportlab.lib.pagesizes import letter
        from reportlab.lib import colors
        from reportlab.lib.units import inch
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet

        if not owns_account(g.user_id, account_id) and g.role != "admin":
            return fail("Not found.", status=404)

        account = Account.query.get(account_id)
        owner = User.query.get(account.user_id) if account else None
        rows = filtered_transactions(account_id, request.args)

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.6 * inch, bottomMargin=0.6 * inch)
        styles = getSampleStyleSheet()
        elements = [
            Paragraph("Meridian Bank — Account Statement", styles["Title"]),
            Paragraph(f"Account: {account_id} ({account.account_type if account else ''})", styles["Normal"]),
            Paragraph(f"Holder: {owner.full_name if owner else ''}", styles["Normal"]),
            Paragraph(f"Generated: {now_iso()}", styles["Normal"]),
            Spacer(1, 0.25 * inch),
        ]

        table_data = [["Date", "Type", "Description", "Counterparty", "Amount", "Balance"]]
        for r in rows:
            sign = "-" if r.type in ("transfer_out", "withdrawal") else "+"
            table_data.append([
                r.timestamp[:10], r.type.replace("_", " "), (r.description or "")[:30],
                r.counterparty_account or "-", f"{sign}${r.amount:.2f}", f"${r.balance_after:.2f}",
            ])

        table = Table(table_data, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#10151F")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DCE0DA")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F2F4F2")]),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        elements.append(table)
        elements.append(Spacer(1, 0.3 * inch))
        elements.append(Paragraph(
            "This is a demo statement from a fictional banking platform. Not a real financial document.",
            styles["Italic"],
        ))
        doc.build(elements)

        log_event("statement_downloaded", actor_id=g.user_id, target=account_id, metadata={"format": "pdf"})

        buffer.seek(0)
        return Response(
            buffer.read(), mimetype="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=statement_{account_id}.pdf"},
        )

    # ── KYC ──────────────────────────────────────────────────────────────
    @app.route("/api/kyc/submit", methods=["POST"])
    @jwt_required
    @csrf_protected
    def submit_kyc():
        data = request.get_json(silent=True) or {}
        required = ["legal_name", "date_of_birth", "id_type", "id_number", "address"]
        missing = [f for f in required if not data.get(f)]
        if missing:
            return fail(f"Missing fields: {', '.join(missing)}", errors=missing)

        try:
            date.fromisoformat(data["date_of_birth"])
        except ValueError:
            return fail("date_of_birth must be YYYY-MM-DD.")

        user = User.query.get(g.user_id)
        record = user.kyc_record or KYCRecord(user_id=user.id)
        record.legal_name = data["legal_name"]
        record.date_of_birth = data["date_of_birth"]
        record.id_type = data["id_type"]
        record.id_number = data["id_number"]
        record.address = data["address"]
        record.ssn_last4 = data.get("ssn_last4", "")
        record.status = "pending"
        record.reviewed_by = None
        record.reviewed_at = None
        record.rejection_reason = None
        record.submitted_at = now_iso()

        db.session.add(record)
        user.kyc_status = "pending"
        db.session.commit()

        log_event("kyc_submitted", actor_id=user.id, actor_username=user.username)
        return ok({}, "KYC information submitted for review.")

    @app.route("/api/kyc/status", methods=["GET"])
    @jwt_required
    def kyc_status():
        user = User.query.get(g.user_id)
        record = user.kyc_record
        return ok({"kyc_status": user.kyc_status, "record": record.to_dict() if record else None})

    # ── Settings ─────────────────────────────────────────────────────────
    @app.route("/api/settings/change-password", methods=["POST"])
    @jwt_required
    @csrf_protected
    def change_password():
        data = request.get_json(silent=True) or {}
        current_password = data.get("current_password") or ""
        new_password = data.get("new_password") or ""

        user = User.query.get(g.user_id)
        if not check_password_hash(user.password_hash, current_password):
            log_event("password_change_denied", actor_id=g.user_id, success=False,
                       metadata={"reason": "wrong_current_password"})
            return fail("Current password is incorrect.", status=401)
        if len(new_password) < 8:
            return fail("New password must be at least 8 characters.")
        if check_password_hash(user.password_hash, new_password):
            return fail("New password must be different from your current password.")

        user.password_hash = generate_password_hash(new_password)
        db.session.commit()
        log_event("password_changed", actor_id=g.user_id, actor_username=user.username)
        return ok({}, "Password updated.")

    @app.route("/api/settings/profile", methods=["POST"])
    @jwt_required
    @csrf_protected
    def update_profile():
        data = request.get_json(silent=True) or {}
        user = User.query.get(g.user_id)

        email = data.get("email")
        phone = data.get("phone_number")
        if email is not None:
            user.email = email.strip() or None
        if phone is not None:
            user.phone_number = phone.strip() or None

        db.session.commit()
        log_event("profile_updated", actor_id=g.user_id, actor_username=user.username)
        return ok({"user": user.to_dict()}, "Profile updated.")

    # ── Admin ────────────────────────────────────────────────────────────
    @app.route("/api/admin/users", methods=["GET"])
    @jwt_required
    @admin_required
    def admin_list_users():
        users = User.query.all()
        result = []
        for u in users:
            accounts = Account.query.filter_by(user_id=u.id).all()
            result.append({**u.to_dict(), "accounts": [a.to_dict() for a in accounts]})
        return ok({"users": result})

    @app.route("/api/admin/accounts/<account_id>/toggle-freeze", methods=["POST"])
    @jwt_required
    @admin_required
    @csrf_protected
    def admin_toggle_freeze(account_id):
        account = Account.query.get(account_id)
        if not account:
            return fail("Account not found.", status=404)
        account.is_frozen = not account.is_frozen
        db.session.commit()
        log_event("admin_account_freeze_toggled", actor_id=g.user_id, target=account_id,
                   metadata={"is_frozen": account.is_frozen})
        return ok({"is_frozen": account.is_frozen})

    @app.route("/api/admin/transactions", methods=["GET"])
    @jwt_required
    @admin_required
    def admin_all_transactions():
        limit = min(int(request.args.get("limit", 100)), 500)
        rows = Transaction.query.order_by(Transaction.id.desc()).limit(limit).all()
        return ok({"transactions": [t.to_dict() for t in rows]})

    @app.route("/api/admin/transactions/flagged", methods=["GET"])
    @jwt_required
    @admin_required
    def admin_flagged_transactions():
        rows = (Transaction.query.filter_by(is_flagged=True, flag_cleared=False)
                .order_by(Transaction.id.desc()).all())
        return ok({"transactions": [t.to_dict() for t in rows]})

    @app.route("/api/admin/transactions/<int:txn_id>/clear-flag", methods=["POST"])
    @jwt_required
    @admin_required
    @csrf_protected
    def admin_clear_flag(txn_id):
        txn = Transaction.query.get(txn_id)
        if not txn:
            return fail("Transaction not found.", status=404)
        txn.flag_cleared = True
        db.session.commit()
        log_event("aml_flag_cleared", actor_id=g.user_id, target=str(txn_id))
        return ok({})

    @app.route("/api/admin/kyc/pending", methods=["GET"])
    @jwt_required
    @admin_required
    def admin_kyc_pending():
        rows = KYCRecord.query.filter_by(status="pending").order_by(KYCRecord.submitted_at.asc()).all()
        return ok({"records": [r.to_dict(reveal_sensitive=True) for r in rows]})

    @app.route("/api/admin/kyc/<int:record_id>/review", methods=["POST"])
    @jwt_required
    @admin_required
    @csrf_protected
    def admin_kyc_review(record_id):
        data = request.get_json(silent=True) or {}
        decision = data.get("decision")
        if decision not in ("verified", "rejected"):
            return fail("decision must be 'verified' or 'rejected'.")

        record = KYCRecord.query.get(record_id)
        if not record:
            return fail("KYC record not found.", status=404)

        admin_user = User.query.get(g.user_id)
        record.status = decision
        record.reviewed_by = admin_user.username
        record.reviewed_at = now_iso()
        if decision == "rejected":
            record.rejection_reason = data.get("reason", "Not specified")

        user = User.query.get(record.user_id)
        user.kyc_status = decision
        db.session.commit()

        log_event("kyc_reviewed", actor_id=admin_user.id, actor_username=admin_user.username,
                   target=str(record.user_id), metadata={"decision": decision})
        return ok({})

    @app.route("/api/admin/audit-log", methods=["GET"])
    @jwt_required
    @admin_required
    def admin_audit_log():
        limit = min(int(request.args.get("limit", 100)), 500)
        rows = AuditLog.query.order_by(AuditLog.id.desc()).limit(limit).all()
        return ok({"entries": [r.to_dict() for r in rows]})

    @app.route("/api/admin/audit-log/verify", methods=["GET"])
    @jwt_required
    @admin_required
    def admin_audit_verify():
        is_valid, broken_id = verify_chain()
        return ok({"chain_valid": is_valid, "broken_at_id": broken_id})

    @app.route("/api/admin/analytics", methods=["GET"])
    @jwt_required
    @admin_required
    def admin_analytics():
        users = User.query.all()
        customers = [u for u in users if u.role == "user"]
        accounts = Account.query.all()

        kyc_breakdown = {"unverified": 0, "pending": 0, "verified": 0, "rejected": 0}
        for u in customers:
            kyc_breakdown[u.kyc_status] = kyc_breakdown.get(u.kyc_status, 0) + 1

        accounts_by_type = {}
        total_deposits = Decimal("0")
        for a in accounts:
            accounts_by_type[a.account_type] = accounts_by_type.get(a.account_type, 0) + 1
            total_deposits += a.balance

        window_start = (datetime.now(timezone.utc) - timedelta(days=13)).date()
        daily = {}
        for i in range(14):
            d = (window_start + timedelta(days=i)).isoformat()
            daily[d] = {"date": d, "count": 0, "volume": 0.0}

        recent_txns = Transaction.query.filter(Transaction.timestamp >= window_start.isoformat()).all()
        for t in recent_txns:
            day = t.timestamp[:10]
            if day in daily:
                daily[day]["count"] += 1
                daily[day]["volume"] += float(t.amount)

        flagged_open = Transaction.query.filter_by(is_flagged=True, flag_cleared=False).count()
        pending_transfers = TransferRequest.query.filter_by(status="pending").all()
        pending_volume = sum((t.amount for t in pending_transfers), Decimal("0"))

        cards = Card.query.all()
        frozen_cards = sum(1 for c in cards if c.status == "frozen")

        return ok({
            "total_customers": len(customers),
            "total_accounts": len(accounts),
            "total_deposits": float(total_deposits),
            "accounts_by_type": accounts_by_type,
            "kyc_breakdown": kyc_breakdown,
            "daily_volume": list(daily.values()),
            "flagged_open_count": flagged_open,
            "pending_transfers_count": len(pending_transfers),
            "pending_transfers_volume": float(pending_volume),
            "total_cards": len(cards),
            "frozen_cards": frozen_cards,
        })


def _mask_phone(phone):
    if not phone or len(phone) < 4:
        return "your phone on file"
    return "•" * max(len(phone) - 4, 0) + phone[-4:]


app = create_app()

if __name__ == "__main__":
    with app.app_context():
        from seed import seed_if_empty
        db.create_all()
        seed_if_empty()
    app.run(host="127.0.0.1", port=5000, debug=True)
