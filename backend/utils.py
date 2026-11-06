import random


def generate_account_number(exists_fn):
    """16 digits, same length as a card number, formatted as plain digits in
    storage (display code adds the spacing). exists_fn(candidate) should
    return True if that number is already taken."""
    while True:
        candidate = "".join(str(random.randint(0, 9)) for _ in range(16))
        if not exists_fn(candidate):
            return candidate
