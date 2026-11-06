"""
SQLAlchemy models for the Postgres-backed bank.

Money is stored as Numeric(14, 2), not float — floats lose precision on
currency math (classic bug). Decimal is used throughout the app for the
same reason.

PII (email, phone number, and everything in KYCRecord) is encrypted at rest
using Fernet (see security.py). The raw columns hold ciphertext; the
`email` / `phone_number` etc. Python properties transparently encrypt on
write and decrypt on read, so the rest of the codebase just uses
`user.email` like a normal attribute.
"""

import hashlib
from datetime import datetime, timezone

from extensions import db
from security import encrypt_field, decrypt_field


def now_iso():
    return datetime.now(timezone.utc).isoformat()


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(16), nullable=False, default="user")  # 'user' | 'admin'
    kyc_status = db.Column(db.String(16), nullable=False, default="unverified")
    # 'unverified' | 'pending' | 'verified' | 'rejected'
    created_at = db.Column(db.String(40), nullable=False, default=now_iso)

    _email_enc = db.Column("email_encrypted", db.Text, nullable=True)
    _phone_enc = db.Column("phone_encrypted", db.Text, nullable=True)

    accounts = db.relationship("Account", backref="owner", lazy=True)
    kyc_record = db.relationship("KYCRecord", backref="user", uselist=False, lazy=True)

    @property
    def email(self):
        return decrypt_field(self._email_enc)

    @email.setter
    def email(self, value):
        self._email_enc = encrypt_field(value)

    @property
    def phone_number(self):
        return decrypt_field(self._phone_enc)

    @phone_number.setter
    def phone_number(self, value):
        self._phone_enc = encrypt_field(value)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "full_name": self.full_name,
            "email": self.email,
            "phone_number": self.phone_number,
            "role": self.role,
            "kyc_status": self.kyc_status,
            "created_at": self.created_at,
        }


class Account(db.Model):
    __tablename__ = "accounts"

    account_id = db.Column(db.String(20), primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    account_type = db.Column(db.String(16), nullable=False)  # 'checking' | 'savings'
    balance = db.Column(db.Numeric(14, 2), nullable=False, default=0)
    is_frozen = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.String(40), nullable=False, default=now_iso)

    transactions = db.relationship("Transaction", backref="account", lazy=True)
    cards = db.relationship("Card", backref="account", lazy=True)

    def to_dict(self):
        return {
            "account_id": self.account_id,
            "account_type": self.account_type,
            "balance": float(self.balance),
            "is_frozen": self.is_frozen,
        }


class Transaction(db.Model):
    __tablename__ = "transactions"

    id = db.Column(db.Integer, primary_key=True)
    account_id = db.Column(db.String(20), db.ForeignKey("accounts.account_id"), nullable=False)
    type = db.Column(db.String(20), nullable=False)  # deposit | withdrawal | transfer_in | transfer_out
    amount = db.Column(db.Numeric(14, 2), nullable=False)
    counterparty_account = db.Column(db.String(20), nullable=True)
    description = db.Column(db.String(140), nullable=True)
    balance_after = db.Column(db.Numeric(14, 2), nullable=False)
    timestamp = db.Column(db.String(40), nullable=False, default=now_iso)
    is_flagged = db.Column(db.Boolean, nullable=False, default=False)
    flag_reason = db.Column(db.String(64), nullable=True)
    flag_cleared = db.Column(db.Boolean, nullable=False, default=False)

    def to_dict(self):
        return {
            "id": self.id,
            "account_id": self.account_id,
            "type": self.type,
            "amount": float(self.amount),
            "counterparty_account": self.counterparty_account,
            "description": self.description,
            "balance_after": float(self.balance_after),
            "timestamp": self.timestamp,
            "is_flagged": self.is_flagged,
            "flag_reason": self.flag_reason,
            "flag_cleared": self.flag_cleared,
        }


class TransferRequest(db.Model):
    """A submitted transfer awaiting admin approval. No balances move until
    an admin approves - only then are the two Transaction ledger rows
    created, same as the old immediate-execution flow."""
    __tablename__ = "transfer_requests"

    id = db.Column(db.Integer, primary_key=True)
    reference = db.Column(db.String(20), unique=True, nullable=False)
    from_account = db.Column(db.String(20), db.ForeignKey("accounts.account_id"), nullable=False)
    to_account = db.Column(db.String(20), db.ForeignKey("accounts.account_id"), nullable=False)
    amount = db.Column(db.Numeric(14, 2), nullable=False)
    description = db.Column(db.String(140), nullable=True)
    requested_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    status = db.Column(db.String(16), nullable=False, default="pending")  # pending | approved | rejected
    is_flagged = db.Column(db.Boolean, nullable=False, default=False)
    flag_reason = db.Column(db.String(64), nullable=True)
    created_at = db.Column(db.String(40), nullable=False, default=now_iso)
    reviewed_by = db.Column(db.String(64), nullable=True)
    reviewed_at = db.Column(db.String(40), nullable=True)
    rejection_reason = db.Column(db.String(255), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "reference": self.reference,
            "from_account": self.from_account,
            "to_account": self.to_account,
            "amount": float(self.amount),
            "description": self.description,
            "status": self.status,
            "is_flagged": self.is_flagged,
            "flag_reason": self.flag_reason,
            "created_at": self.created_at,
            "reviewed_by": self.reviewed_by,
            "reviewed_at": self.reviewed_at,
            "rejection_reason": self.rejection_reason,
        }


class Card(db.Model):
    __tablename__ = "cards"

    id = db.Column(db.Integer, primary_key=True)
    account_id = db.Column(db.String(20), db.ForeignKey("accounts.account_id"), nullable=False)
    last4 = db.Column(db.String(4), nullable=False)
    expiry = db.Column(db.String(5), nullable=False)  # MM/YY
    card_type = db.Column(db.String(16), nullable=False, default="debit")
    status = db.Column(db.String(16), nullable=False, default="active")  # active | frozen
    is_virtual = db.Column(db.Boolean, nullable=False, default=False)
    spending_limit = db.Column(db.Numeric(10, 2), nullable=False, default=5000)

    _full_number_enc = db.Column("card_number_encrypted", db.Text, nullable=True)
    _cvv_enc = db.Column("cvv_encrypted", db.Text, nullable=True)

    @property
    def full_number(self):
        return decrypt_field(self._full_number_enc)

    @full_number.setter
    def full_number(self, value):
        self._full_number_enc = encrypt_field(value)

    @property
    def cvv(self):
        return decrypt_field(self._cvv_enc)

    @cvv.setter
    def cvv(self, value):
        self._cvv_enc = encrypt_field(value)

    def to_dict(self):
        return {
            "id": self.id,
            "account_id": self.account_id,
            "last4": self.last4,
            "expiry": self.expiry,
            "card_type": self.card_type,
            "status": self.status,
            "is_virtual": self.is_virtual,
            "spending_limit": float(self.spending_limit),
        }


class ActiveOTP(db.Model):
    __tablename__ = "active_otps"

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), primary_key=True)
    otp_hash = db.Column(db.String(64), nullable=False)  # sha256, never store the raw code
    purpose = db.Column(db.String(16), nullable=False, default="login")  # 'login' | 'transfer'
    created_at = db.Column(db.String(40), nullable=False, default=now_iso)
    expires_at = db.Column(db.String(40), nullable=False)
    attempts = db.Column(db.Integer, nullable=False, default=0)
    is_verified = db.Column(db.Boolean, nullable=False, default=False)

    @staticmethod
    def hash_code(code):
        return hashlib.sha256(code.encode()).hexdigest()

    def matches(self, code):
        return self.otp_hash == self.hash_code(code)

    def is_expired(self):
        return datetime.fromisoformat(self.expires_at) < datetime.now(timezone.utc)


class RefreshToken(db.Model):
    """Tracks issued refresh tokens so logout / rotation can actually revoke them.
    Access tokens are short-lived and stateless (not tracked here) - the whole
    point of the access/refresh split is that only this table needs a DB hit."""
    __tablename__ = "refresh_tokens"

    id = db.Column(db.Integer, primary_key=True)
    jti = db.Column(db.String(64), unique=True, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    expires_at = db.Column(db.String(40), nullable=False)
    revoked = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.String(40), nullable=False, default=now_iso)


class KYCRecord(db.Model):
    __tablename__ = "kyc_records"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False)
    legal_name = db.Column(db.String(120), nullable=False)
    date_of_birth = db.Column(db.String(10), nullable=False)  # YYYY-MM-DD
    id_type = db.Column(db.String(32), nullable=False)  # passport | drivers_license | national_id
    status = db.Column(db.String(16), nullable=False, default="pending")  # pending | verified | rejected
    submitted_at = db.Column(db.String(40), nullable=False, default=now_iso)
    reviewed_by = db.Column(db.String(64), nullable=True)
    reviewed_at = db.Column(db.String(40), nullable=True)
    rejection_reason = db.Column(db.String(255), nullable=True)

    _id_number_enc = db.Column("id_number_encrypted", db.Text, nullable=False)
    _address_enc = db.Column("address_encrypted", db.Text, nullable=False)
    _ssn_last4_enc = db.Column("ssn_last4_encrypted", db.Text, nullable=True)

    @property
    def id_number(self):
        return decrypt_field(self._id_number_enc)

    @id_number.setter
    def id_number(self, value):
        self._id_number_enc = encrypt_field(value)

    @property
    def address(self):
        return decrypt_field(self._address_enc)

    @address.setter
    def address(self, value):
        self._address_enc = encrypt_field(value)

    @property
    def ssn_last4(self):
        return decrypt_field(self._ssn_last4_enc)

    @ssn_last4.setter
    def ssn_last4(self, value):
        self._ssn_last4_enc = encrypt_field(value)

    def to_dict(self, reveal_sensitive=False):
        base = {
            "id": self.id,
            "user_id": self.user_id,
            "legal_name": self.legal_name,
            "date_of_birth": self.date_of_birth,
            "id_type": self.id_type,
            "status": self.status,
            "submitted_at": self.submitted_at,
            "reviewed_by": self.reviewed_by,
            "reviewed_at": self.reviewed_at,
            "rejection_reason": self.rejection_reason,
        }
        if reveal_sensitive:
            base["id_number"] = self.id_number
            base["address"] = self.address
            base["ssn_last4"] = self.ssn_last4
        else:
            base["id_number"] = _mask(self.id_number)
            base["ssn_last4"] = self.ssn_last4  # already just last 4
        return base


def _mask(value, keep=4):
    if not value:
        return value
    return "•" * max(len(value) - keep, 0) + value[-keep:]


class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.String(40), nullable=False, default=now_iso)
    action = db.Column(db.String(64), nullable=False)
    actor_username = db.Column(db.String(64), nullable=True)
    actor_id = db.Column(db.Integer, nullable=True)
    target = db.Column(db.String(64), nullable=True)
    success = db.Column(db.Boolean, nullable=False, default=True)
    metadata_json = db.Column(db.Text, nullable=True)
    ip_address = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
    prev_hash = db.Column(db.String(64), nullable=True)
    entry_hash = db.Column(db.String(64), nullable=False)

    def to_dict(self):
        import json
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "action": self.action,
            "actor_username": self.actor_username,
            "target": self.target,
            "success": self.success,
            "metadata": json.loads(self.metadata_json or "{}"),
            "ip_address": self.ip_address,
        }
