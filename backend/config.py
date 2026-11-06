import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()


class Config:
    # ── Database ──────────────────────────────────────────────────────────
    # Real deployments point this at Postgres, e.g.:
    #   postgresql+psycopg2://bank_user:bank_pass@localhost:5432/meridian_bank
    # docker-compose.yml in this folder spins up exactly that.
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", "postgresql+psycopg://bank_user:bank_pass@localhost:5432/meridian_bank"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # ── Secrets ───────────────────────────────────────────────────────────
    SECRET_KEY = os.environ.get("BANK_SECRET_KEY", "")
    # Fernet key (32 url-safe base64 bytes) used to encrypt PII columns at rest
    # (phone numbers, emails, KYC documents). Generate one with:
    #   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    FIELD_ENCRYPTION_KEY = os.environ.get("FIELD_ENCRYPTION_KEY", "")

    # ── JWT (hybrid: JWT payload, delivered via httponly cookies) ────────────
    JWT_SECRET = os.environ.get("JWT_SECRET", "")
    ACCESS_TOKEN_EXPIRY_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRY_MINUTES", "15"))
    REFRESH_TOKEN_EXPIRY_DAYS = int(os.environ.get("REFRESH_TOKEN_EXPIRY_DAYS", "7"))

    # ── OTP ───────────────────────────────────────────────────────────────
    OTP_EXPIRY_MINUTES = int(os.environ.get("OTP_EXPIRY_MINUTES", "5"))
    OTP_MAX_ATTEMPTS = int(os.environ.get("OTP_MAX_ATTEMPTS", "5"))
    OTP_RESEND_COOLDOWN_SECONDS = int(os.environ.get("OTP_RESEND_COOLDOWN_SECONDS", "30"))

    # ── Environment ───────────────────────────────────────────────────────
    # In development, OTP codes are echoed back in API responses (in addition
    # to being printed/texted) so you're not tabbing to the server terminal
    # for every login while building the frontend. This is never done outside
    # development, regardless of SMS_PROVIDER.
    ENV = os.environ.get("ENV", "development")
    SMS_PROVIDER = os.environ.get("SMS_PROVIDER", "console")  # console | mock | twilio

    # ── Cookies (the two JWTs live here, both httponly; csrf_token is a third,
    #    deliberately NON-httponly cookie so the page's own JS can read it and
    #    echo it back as a header - that's what makes double-submit CSRF work) ──
    ACCESS_COOKIE_NAME = "access_token"
    REFRESH_COOKIE_NAME = "refresh_token"
    CSRF_COOKIE_NAME = "csrf_token"
    COOKIE_SECURE = os.environ.get("BANK_HTTPS", "0") == "1"
    COOKIE_SAMESITE = "Lax"

    # ── SMS (Twilio) ──────────────────────────────────────────────────────
    # If these aren't set, OTPs fall back to being printed to the server
    # console (clearly labeled DEV MODE) instead of silently failing.
    TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
    TWILIO_FROM_NUMBER = os.environ.get("TWILIO_FROM_NUMBER", "")

    # ── AML thresholds ────────────────────────────────────────────────────
    AML_LARGE_TXN_THRESHOLD = 10000.00       # CTR-style reporting threshold (USD)
    AML_STRUCTURING_LOW = 9000.00            # "just under the threshold" band
    AML_STRUCTURING_HIGH = 9999.99
    AML_STRUCTURING_WINDOW_HOURS = 24
    AML_STRUCTURING_MIN_COUNT = 3            # N txns in the band within the window = flag

    # ── CORS (dev only - Vite proxy handles same-origin in normal dev use) ──
    CORS_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]
