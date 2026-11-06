"""
Security helpers shared across the app.

Auth model: hybrid JWT-in-httponly-cookie.
  - Access token: short-lived (default 15 min), sent as an httponly cookie on
    every request, decoded per-request to identify the user. Never touches
    JS, so it can't be exfiltrated by an XSS bug the way a localStorage token
    could be - that's the whole point of the hybrid approach over "classic" JWT.
  - Refresh token: longer-lived (default 7 days), httponly cookie scoped to
    /api/auth only (so it isn't even sent on ordinary API calls), tracked in
    the `refresh_tokens` table so logout/rotation can actually revoke it.
    Rotated on every use (old jti revoked, new one issued) - if a stolen
    refresh token gets used, the legitimate user's next refresh will fail
    with a revoked token, which is a detectable signal in a real system.
  - CSRF: a random value is generated once per login and embedded as a claim
    in both tokens. It's also returned once in the JSON response body at
    login/verify-otp time so the frontend can hold its own copy in memory and
    echo it back as the X-CSRF-Token header. The server compares that header
    to the claim decoded from the (httponly, JS-unreadable) cookie. Neither
    side alone is enough to forge a request - this is the standard
    "double-submit" pattern adapted for JWT-in-cookie.

Also includes: Fernet field encryption for PII at rest, and simple in-memory
login throttling. Both unchanged from the session-based version.
"""

import time
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import request, current_app, g
from cryptography.fernet import Fernet, InvalidToken

from responses import fail


# ── Field-level encryption (unchanged) ──────────────────────────────────────
def _fernet():
    key = current_app.config["FIELD_ENCRYPTION_KEY"]
    if not key:
        raise RuntimeError(
            "FIELD_ENCRYPTION_KEY is not set. Generate one with:\n"
            "  python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"\n"
            "and put it in your .env file."
        )
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_field(value):
    if value is None or value == "":
        return None
    return _fernet().encrypt(str(value).encode()).decode()


def decrypt_field(ciphertext):
    if not ciphertext:
        return None
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken:
        return None


# ── Login throttling (per username) ─────────────────────────────────────────
LOGIN_ATTEMPTS = {}
MAX_ATTEMPTS = 5
LOCKOUT_SECONDS = 60


def is_locked_out(username):
    rec = LOGIN_ATTEMPTS.get(username)
    if not rec:
        return False
    return rec["fails"] >= MAX_ATTEMPTS and time.time() < rec["locked_until"]


def register_failed_login(username):
    rec = LOGIN_ATTEMPTS.setdefault(username, {"fails": 0, "locked_until": 0})
    rec["fails"] += 1
    if rec["fails"] >= MAX_ATTEMPTS:
        rec["locked_until"] = time.time() + LOCKOUT_SECONDS


def clear_login_attempts(username):
    LOGIN_ATTEMPTS.pop(username, None)


def new_csrf_token():
    return secrets.token_hex(24)


def new_otp_code():
    return f"{secrets.randbelow(900000) + 100000}"


def hash_otp(code):
    return hashlib.sha256(code.encode()).hexdigest()


# ── JWT ──────────────────────────────────────────────────────────────────────
def _jwt_secret():
    key = current_app.config["JWT_SECRET"]
    if not key:
        raise RuntimeError(
            "JWT_SECRET is not set. Generate one with:\n"
            "  python -c \"import secrets; print(secrets.token_hex(32))\"\n"
            "and put it in your .env file."
        )
    return key


def _encode(payload, expires_in):
    now = datetime.now(timezone.utc)
    full_payload = {**payload, "iat": now, "exp": now + expires_in}
    return jwt.encode(full_payload, _jwt_secret(), algorithm="HS256")


def decode_token(token):
    """Raises jwt.ExpiredSignatureError or jwt.InvalidTokenError - callers catch these."""
    return jwt.decode(token, _jwt_secret(), algorithms=["HS256"])


def create_pending_otp_token(user_id):
    """Short-lived token proving 'this browser just supplied the correct
    password for this user' without granting any real access - it can only
    be used against /api/auth/verify-otp and /api/auth/resend-otp."""
    return _encode({"sub": str(user_id), "type": "pending_otp"}, timedelta(minutes=10))


def create_access_token(user_id, role, csrf_token):
    minutes = current_app.config["ACCESS_TOKEN_EXPIRY_MINUTES"]
    return _encode({"sub": str(user_id), "role": role, "csrf": csrf_token, "type": "access"},
                    timedelta(minutes=minutes))


def create_refresh_token(user_id, csrf_token, jti):
    days = current_app.config["REFRESH_TOKEN_EXPIRY_DAYS"]
    return _encode({"sub": str(user_id), "csrf": csrf_token, "jti": jti, "type": "refresh"},
                    timedelta(days=days))


def set_auth_cookies(response, access_token, refresh_token, csrf_token):
    cfg = current_app.config
    response.set_cookie(
        cfg["ACCESS_COOKIE_NAME"], access_token, httponly=True, samesite=cfg["COOKIE_SAMESITE"],
        secure=cfg["COOKIE_SECURE"], max_age=cfg["ACCESS_TOKEN_EXPIRY_MINUTES"] * 60, path="/",
    )
    response.set_cookie(
        cfg["REFRESH_COOKIE_NAME"], refresh_token, httponly=True, samesite=cfg["COOKIE_SAMESITE"],
        secure=cfg["COOKIE_SECURE"], max_age=cfg["REFRESH_TOKEN_EXPIRY_DAYS"] * 86400, path="/api/auth",
    )
    # Deliberately NOT httponly - the frontend needs to read this to echo it
    # back as X-CSRF-Token. A cross-site attacker can't read it either way
    # (cookies aren't readable across origins), so this doesn't weaken anything.
    response.set_cookie(
        cfg["CSRF_COOKIE_NAME"], csrf_token, httponly=False, samesite=cfg["COOKIE_SAMESITE"],
        secure=cfg["COOKIE_SECURE"], max_age=cfg["REFRESH_TOKEN_EXPIRY_DAYS"] * 86400, path="/",
    )
    return response


def clear_auth_cookies(response):
    cfg = current_app.config
    response.delete_cookie(cfg["ACCESS_COOKIE_NAME"], path="/")
    response.delete_cookie(cfg["REFRESH_COOKIE_NAME"], path="/api/auth")
    response.delete_cookie(cfg["CSRF_COOKIE_NAME"], path="/")
    return response


# ── Decorators ───────────────────────────────────────────────────────────────
def jwt_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        token = request.cookies.get(current_app.config["ACCESS_COOKIE_NAME"])
        if not token:
            return fail("Unauthorized.", status=401)
        try:
            payload = decode_token(token)
        except jwt.ExpiredSignatureError:
            return fail("Access token expired.", errors=["token_expired"], status=401)
        except jwt.InvalidTokenError:
            return fail("Unauthorized.", status=401)

        if payload.get("type") != "access":
            return fail("Unauthorized.", status=401)

        g.user_id = int(payload["sub"])
        g.role = payload.get("role")
        g.csrf = payload.get("csrf")
        return f(*args, **kwargs)
    return wrapper


def admin_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if getattr(g, "role", None) != "admin":
            return fail("Admin access required.", status=403)
        return f(*args, **kwargs)
    return wrapper


def csrf_protected(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        header_token = request.headers.get("X-CSRF-Token", "")
        if not header_token or header_token != getattr(g, "csrf", None):
            return fail("CSRF token missing or invalid.", status=403)
        return f(*args, **kwargs)
    return wrapper
