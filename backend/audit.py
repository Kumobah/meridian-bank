"""
Audit logging.

Every security-relevant action (login attempts, transfers, admin actions,
KYC decisions, statement downloads) gets written to the `audit_logs` table
AND to an append-only file (logs/audit.log), one JSON object per line.

Tamper-evidence: each row stores a sha256 hash of its own contents chained
to the previous row's hash (like a mini blockchain). If someone edits or
deletes a row in the middle of the table without recomputing every hash
after it, `verify_chain()` will detect the break. This doesn't replace a
real SIEM / centralized log shipping in production, but it means a rogue
insider (or attacker) can't quietly rewrite history in the DB alone.
"""

import json
import hashlib
import os
from datetime import datetime, timezone

from flask import request

from extensions import db

AUDIT_LOG_FILE = os.path.join(os.path.dirname(__file__), "logs", "audit.log")


def _hash_entry(prev_hash, payload):
    blob = (prev_hash or "") + json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha256(blob.encode()).hexdigest()


def log_event(action, actor_username=None, actor_id=None, target=None, success=True, metadata=None):
    from models import AuditLog  # local import avoids circular import with models.py

    timestamp = datetime.now(timezone.utc).isoformat()
    ip = request.remote_addr if request else None
    user_agent = request.headers.get("User-Agent") if request else None

    payload = {
        "timestamp": timestamp,
        "action": action,
        "actor_username": actor_username,
        "actor_id": actor_id,
        "target": target,
        "success": success,
        "metadata": metadata or {},
        "ip_address": ip,
        "user_agent": user_agent,
    }

    last = AuditLog.query.order_by(AuditLog.id.desc()).first()
    prev_hash = last.entry_hash if last else None
    entry_hash = _hash_entry(prev_hash, payload)

    row = AuditLog(
        timestamp=timestamp,
        action=action,
        actor_username=actor_username,
        actor_id=actor_id,
        target=target,
        success=success,
        metadata_json=json.dumps(metadata or {}),
        ip_address=ip,
        user_agent=user_agent,
        prev_hash=prev_hash,
        entry_hash=entry_hash,
    )
    db.session.add(row)
    db.session.commit()

    try:
        os.makedirs(os.path.dirname(AUDIT_LOG_FILE), exist_ok=True)
        with open(AUDIT_LOG_FILE, "a") as f:
            f.write(json.dumps({**payload, "entry_hash": entry_hash}) + "\n")
    except OSError:
        # File logging is best-effort backup; the DB row is the source of truth.
        pass

    return row


def verify_chain():
    """Walk the whole audit_logs table and confirm every hash chains correctly.
    Returns (is_valid, first_broken_id_or_None)."""
    from models import AuditLog

    prev_hash = None
    for row in AuditLog.query.order_by(AuditLog.id.asc()).all():
        payload = {
            "timestamp": row.timestamp,
            "action": row.action,
            "actor_username": row.actor_username,
            "actor_id": row.actor_id,
            "target": row.target,
            "success": row.success,
            "metadata": json.loads(row.metadata_json or "{}"),
            "ip_address": row.ip_address,
            "user_agent": row.user_agent,
        }
        expected = _hash_entry(prev_hash, payload)
        if expected != row.entry_hash or row.prev_hash != prev_hash:
            return False, row.id
        prev_hash = row.entry_hash
    return True, None
