"""
SMS provider abstraction.

Selected via the SMS_PROVIDER env var:
  console  (default) - prints the code to the server terminal, clearly labeled
  mock                - simulates a delivery API round-trip without printing
                        the raw code (useful for demoing "looks production-like"
                        behavior without wiring a real provider)
  twilio              - sends a real SMS via Twilio (needs TWILIO_* env vars)

All providers implement the same .send(phone_number, code) -> dict interface,
so swapping providers is a one-line env var change, never a code change.
Adding a new provider later just means adding one more class + factory branch.
"""

from flask import current_app


class BaseProvider:
    def send(self, phone_number, code):
        raise NotImplementedError


class ConsoleProvider(BaseProvider):
    """Default for local dev - never fails, never needs credentials."""

    def send(self, phone_number, code):
        print("\n" + "═" * 60)
        print("🚨 [SMS: console provider - no real SMS was sent]")
        print(f" Phone   : {phone_number}")
        print(f" OTP CODE: [ {code} ]")
        print("═" * 60 + "\n")
        return {"delivered": False, "channel": "console"}


class MockProvider(BaseProvider):
    """Simulates a provider round-trip (e.g. for demoing loading states /
    latency in the UI) without exposing the code in plain server logs the
    way ConsoleProvider does. Still not a real send - nothing leaves the box."""

    def send(self, phone_number, code):
        print(f"[SMS: mock provider] Simulated delivery to {phone_number[:-4]}••••.")
        return {"delivered": False, "channel": "mock"}


class TwilioProvider(BaseProvider):
    def __init__(self, sid, token, from_number):
        self.sid, self.token, self.from_number = sid, token, from_number

    def send(self, phone_number, code):
        try:
            from twilio.rest import Client  # optional dependency, imported lazily
        except ImportError:
            print("[SMS: twilio provider] The 'twilio' package isn't installed "
                  "(pip install twilio). Falling back to console.")
            return ConsoleProvider().send(phone_number, code)

        try:
            client = Client(self.sid, self.token)
            message = client.messages.create(
                body=f"Your Meridian Bank verification code is {code}. It expires shortly.",
                from_=self.from_number,
                to=phone_number,
            )
            return {"delivered": True, "channel": "twilio", "sid": message.sid}
        except Exception as e:
            print(f"[SMS: twilio provider] Send failed ({e}); falling back to console.")
            return ConsoleProvider().send(phone_number, code)


def get_sms_provider():
    provider = current_app.config.get("SMS_PROVIDER", "console")

    if provider == "twilio":
        sid = current_app.config.get("TWILIO_ACCOUNT_SID")
        token = current_app.config.get("TWILIO_AUTH_TOKEN")
        from_number = current_app.config.get("TWILIO_FROM_NUMBER")
        if sid and token and from_number:
            return TwilioProvider(sid, token, from_number)
        print("[SMS] SMS_PROVIDER=twilio but TWILIO_* credentials are missing. Falling back to console.")
        return ConsoleProvider()

    if provider == "mock":
        return MockProvider()

    return ConsoleProvider()
