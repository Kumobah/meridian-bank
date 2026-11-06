"""
Lightweight AML (anti-money-laundering) transaction monitoring.

Two simple, well-known heuristics real banks use as a first line of defense:

1. Large transaction reporting - transfers at or above a threshold (modeled on
   the US Currency Transaction Report trigger of $10,000) get flagged for
   review rather than blocked outright.

2. Structuring detection - multiple transfers deliberately kept just under
   the reporting threshold, in a short window, is a classic evasion pattern
   ("smurfing"). We flag N+ transfers in the $9,000-$9,999.99 band from the
   same account within 24 hours.

This is NOT a real AML program. A real one involves OFAC/sanctions list
screening, beneficial-ownership checks, a licensed BSA officer, SAR filing
with FinCEN, and a lot more nuance than two if-statements. See COMPLIANCE.md.
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from flask import current_app


def evaluate_transaction(session_db, account_id, amount: Decimal):
    """Returns (is_flagged: bool, reason: str|None).

    Queries TransferRequest, not completed Transaction rows: transfers now
    sit pending until an admin approves them, so a structuring pattern could
    otherwise consist entirely of not-yet-approved requests and never trip
    this check if it only looked at completed transfers. Rejected requests
    are excluded - a rejected request didn't move money and isn't part of
    an evasion pattern by itself."""
    from models import TransferRequest

    large_threshold = Decimal(str(current_app.config["AML_LARGE_TXN_THRESHOLD"]))
    if amount >= large_threshold:
        return True, f"large_transaction_over_{int(large_threshold)}"

    low = Decimal(str(current_app.config["AML_STRUCTURING_LOW"]))
    high = Decimal(str(current_app.config["AML_STRUCTURING_HIGH"]))
    if low <= amount <= high:
        window_hours = current_app.config["AML_STRUCTURING_WINDOW_HOURS"]
        min_count = current_app.config["AML_STRUCTURING_MIN_COUNT"]
        cutoff = datetime.now(timezone.utc) - timedelta(hours=window_hours)

        recent = (
            session_db.query(TransferRequest)
            .filter(
                TransferRequest.from_account == account_id,
                TransferRequest.status.in_(("pending", "approved")),
                TransferRequest.amount >= low,
                TransferRequest.amount <= high,
                TransferRequest.created_at >= cutoff.isoformat(),
            )
            .count()
        )
        # +1 to include the request currently being evaluated
        if recent + 1 >= min_count:
            return True, "possible_structuring"

    return False, None
