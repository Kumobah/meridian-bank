import random
import secrets
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from werkzeug.security import generate_password_hash

from extensions import db
from models import User, Account, Transaction, Card, KYCRecord, TransferRequest, now_iso
from utils import generate_account_number


def seed_if_empty():
    if User.query.first():
        return

    demo_users = [
        ("andrew", "Andrew#2026", "Smitten Andrew", "andrew@example.com", "+15550101", "user", "verified"),
        ("felix", "Felix#2026", "Felix Wagner", "felix@example.com", "+15550102", "user", "pending"),
        ("admin", "admin123", "Bank Administrator", "admin@securebank.example", "+15550100", "admin", "verified"),
    ]

    card_counter = 4821
    accounts_by_user = {}

    for username, pw, full_name, email, phone, role, kyc_status in demo_users:
        user = User(
            username=username,
            password_hash=generate_password_hash(pw),
            full_name=full_name,
            role=role,
            kyc_status=kyc_status,
            created_at=now_iso(),
        )
        user.email = email
        user.phone_number = phone
        db.session.add(user)
        db.session.flush()  # get user.id without committing

        if role == "user":
            accounts_by_user[username] = {}

            # Felix gets round, obviously-demo balances with headroom for the
            # AML demo transfer requests seeded below. Everyone else gets
            # randomized small balances as before.
            if username == "felix":
                balances = (("checking", Decimal("75000.00")), ("savings", Decimal("150000.00")))
            else:
                balances = (
                    ("checking", Decimal(str(round(random.uniform(1500, 6000), 2)))),
                    ("savings", Decimal(str(round(random.uniform(3000, 15000), 2)))),
                )

            for acc_type, starting_balance in balances:
                account_id = generate_account_number(lambda c: Account.query.get(c) is not None)
                accounts_by_user[username][acc_type] = account_id
                account = Account(
                    account_id=account_id,
                    user_id=user.id,
                    account_type=acc_type,
                    balance=starting_balance,
                    created_at=now_iso(),
                )
                db.session.add(account)

                db.session.add(Transaction(
                    account_id=account_id,
                    type="deposit",
                    amount=starting_balance,
                    counterparty_account=None,
                    description="Opening deposit",
                    balance_after=starting_balance,
                    timestamp=now_iso(),
                ))

                if acc_type == "checking":
                    last4 = str(card_counter)
                    card = Card(
                        account_id=account_id,
                        last4=last4,
                        expiry="12/29",
                        card_type="debit",
                        status="active",
                        spending_limit=5000,
                    )
                    # 4111-xxxx-xxxx test BIN prefix (standard "this is a test card" range)
                    card.full_number = f"4111{random.randint(1000, 9999)}{last4}"
                    card.cvv = f"{random.randint(100, 999)}"
                    db.session.add(card)
                    card_counter += 37

    andrew = User.query.filter_by(username="andrew").first()
    andrew_kyc = KYCRecord(
        user_id=andrew.id, legal_name="Smitten Andrew", date_of_birth="1990-04-12",
        id_type="passport", status="verified",
        reviewed_by="admin", reviewed_at=now_iso(),
    )
    andrew_kyc.id_number = "P1234567"
    andrew_kyc.address = "12 Harbor View Rd, Kumasi, Ghana"
    andrew_kyc.ssn_last4 = "1234"
    db.session.add(andrew_kyc)

    felix = User.query.filter_by(username="felix").first()
    felix_kyc = KYCRecord(
        user_id=felix.id, legal_name="Felix Wagner", date_of_birth="1994-09-03",
        id_type="drivers_license", status="pending",
    )
    felix_kyc.id_number = "DE-DL-88213"
    felix_kyc.address = "45 Ridge Ave, Berlin, Germany"
    felix_kyc.ssn_last4 = "5678"
    db.session.add(felix_kyc)

    # ── AML demo data ────────────────────────────────────────────────────
    # A few pending transfer requests from Felix's checking account,
    # constructed to demonstrate the real evaluate_transaction() logic
    # (aml.py) rather than just claiming it works: three transfers in the
    # "structuring" band ($9,000-$9,999) submitted close together only flag
    # on the third, exactly like a real user triggering it would, and one
    # transfer over the $10,000 large-transaction threshold flags immediately.
    # All clearly demo-labeled, all still awaiting admin approval - nothing
    # has actually moved.
    felix_checking = accounts_by_user["felix"]["checking"]
    andrew_checking = accounts_by_user["andrew"]["checking"]
    now = datetime.now(timezone.utc)

    demo_transfers = [
        (Decimal("9200.00"), False, None, "Demo transfer 1/3 (AML structuring test)", now - timedelta(hours=2)),
        (Decimal("9400.00"), False, None, "Demo transfer 2/3 (AML structuring test)", now - timedelta(hours=1)),
        (Decimal("9600.00"), True, "possible_structuring", "Demo transfer 3/3 (AML structuring test - flags here)", now - timedelta(minutes=20)),
        (Decimal("12000.00"), True, "large_transaction_over_10000", "Demo transfer (AML large-amount test)", now - timedelta(minutes=5)),
    ]

    for amount, is_flagged, flag_reason, description, created_at in demo_transfers:
        db.session.add(TransferRequest(
            reference=f"TXN-{secrets.token_hex(5).upper()}",
            from_account=felix_checking,
            to_account=andrew_checking,
            amount=amount,
            description=description,
            requested_by=felix.id,
            status="pending",
            is_flagged=is_flagged,
            flag_reason=flag_reason,
            created_at=created_at.isoformat(),
        ))

    db.session.commit()
    print("[*] Database seeded with demo accounts:")
    print("    andrew / Andrew#2026  (Smitten Andrew, KYC verified)")
    print("    felix  / Felix#2026   (Felix Wagner, KYC pending review)")
    print("    admin  / admin123     (role=admin - approves transfers)")
    print("[*] Seeded 4 demo transfer requests from Felix's checking account -")
    print("    3 flag structuring on the 3rd, 1 flags as a large transaction.")
    print("    Log in as admin -> Pending transfers to review them.")
