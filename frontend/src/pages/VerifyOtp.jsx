import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import AuthHero from "../components/AuthHero.jsx";
import OTPInput from "../components/OTPInput.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function VerifyOtp() {
  const { verifyOtp, resendOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [otpToken, setOtpToken] = useState(location.state?.otpToken || null);
  const [maskedPhone] = useState(location.state?.maskedPhone || "your phone on file");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(location.state?.expiresIn || 300);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!location.state?.otpToken) {
      navigate("/login", { replace: true });
    }
  }, [location.state, navigate]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(s - 1, 0)), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  const submit = useCallback(
    async (finalCode) => {
      if (finalCode.length !== 6 || busy) return;
      setError("");
      setBusy(true);
      try {
        await verifyOtp(otpToken, finalCode);
        setSuccess(true);
        setTimeout(() => navigate("/dashboard"), 900);
      } catch (e) {
        setError(e.message);
        setCode("");
      } finally {
        setBusy(false);
      }
    },
    [otpToken, busy, verifyOtp, navigate]
  );

  const handleChange = (val) => {
    setCode(val);
    if (val.replace(/\D/g, "").length === 6) submit(val);
  };

  const handleResend = async () => {
    setResending(true);
    setError("");
    try {
      const data = await resendOtp(otpToken);
      setSecondsLeft(data.expires_in_seconds || 300);
      setCode("");
      if (data.otp_debug) {
        console.info(`[dev] OTP code: ${data.otp_debug}`);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setResending(false);
    }
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="flex min-h-screen bg-white">
      <AuthHero />

      <div className="flex flex-1 items-center justify-center overflow-y-auto bg-paper px-6 py-10 lg:bg-white">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-soft text-emerald-deep">
            {success ? <CheckCircle2 size={22} /> : <ShieldCheck size={22} />}
          </div>

          <h1 className="font-display text-2xl text-ink">
            {success ? "Verified" : "Enter your code"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {success ? "Taking you to your dashboard…" : `We sent a 6-digit code to ${maskedPhone}`}
          </p>

          {!success && (
            <>
              <div className="mt-8">
                <OTPInput value={code} onChange={handleChange} disabled={busy} />
              </div>

              {error && <p className="mt-4 text-sm text-alert">{error}</p>}

              <p className="mt-6 text-sm text-muted">
                {secondsLeft > 0 ? (
                  <>Code expires in <span className="font-ledger">{mm}:{ss}</span></>
                ) : (
                  "Code expired"
                )}
              </p>

              <button
                onClick={handleResend}
                disabled={secondsLeft > 0 || resending}
                className="mt-3 text-sm font-medium text-emerald hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
              >
                {resending ? "Sending…" : "Resend code"}
              </button>

              <p className="mt-8 text-xs text-muted">
                Wrong account?{" "}
                <Link to="/login" className="font-medium text-emerald hover:underline">
                  Start over
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
