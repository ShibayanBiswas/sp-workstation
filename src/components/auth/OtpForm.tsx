"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, KeyRound } from "lucide-react";
import { AuthAccessStrip } from "@/components/auth/AuthAccessStrip";
import { AuthOtpDisplay } from "@/components/auth/AuthOtpDisplay";
import { AuthShell } from "@/components/auth/AuthShell";

export function OtpForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setEmail(sessionStorage.getItem("sp_login_email") || "");
      setOtp(sessionStorage.getItem("sp_otp_preview") || "");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid code");
        setLoading(false);
        if (data.redirect) {
          setTimeout(() => router.push(data.redirect), 1200);
        }
        return;
      }
      sessionStorage.removeItem("sp_otp_preview");
      sessionStorage.removeItem("sp_login_email");
      setLoading(false);
      router.push(data.redirect || "/dashboard");
    } catch {
      setError("Verification failed. Returning to login…");
      setLoading(false);
      setTimeout(() => router.push("/login"), 1200);
    }
  }

  return (
    <AuthShell subtitle="VERIFICATION" variant="verify">
      <div className="auth-card auth-card-large animate-rise auth-card-alive">
        <div className="auth-card-accent" aria-hidden />

        <header className="auth-header">
          <div className="min-w-0 flex-1">
            <p className="auth-eyebrow">Structured Products Desk · Step 2 of 2</p>
            <h1 className="auth-title">Verify access</h1>
            <p className="auth-lead">
              Enter the verification code shown below for{" "}
              <span className="font-semibold text-[var(--gold-deep)] dark:text-[var(--gold-soft)]">
                {email || "your account"}
              </span>
              . The code is generated locally on this workstation.
            </p>
          </div>
          <div className="auth-icon-badge">
            <KeyRound size={24} strokeWidth={1.75} />
          </div>
        </header>

        <div className="auth-divider" />

        <AuthAccessStrip variant="verify" />

        <div className="auth-verify-zone">
          {otp ? (
            <AuthOtpDisplay otp={otp} />
          ) : (
            <p className="auth-error">
              Code unavailable. Return to sign in and try again.
            </p>
          )}

          <form onSubmit={onSubmit} className="auth-form">
            <div className="auth-field">
              <label className="auth-label" htmlFor="otp-code">
                Enter code
              </label>
              <input
                id="otp-code"
                className="input-field auth-input auth-otp-input w-full"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                required
                autoFocus
              />
            </div>

            {error ? <p className="auth-error">{error}</p> : null}

            <div className="auth-actions">
              <button
                type="submit"
                className="btn-primary auth-submit w-full"
                disabled={loading || code.length !== 6 || !otp}
              >
                {loading ? "Verifying…" : "Enter workstation"}
                {!loading ? <ArrowRight size={16} /> : null}
              </button>
            </div>
          </form>
        </div>

        <footer className="auth-footer">
          <Link href="/login" className="auth-link auth-back">
            ← Back to sign in
          </Link>
          <p className="auth-footnote mt-4">
            Authorised Anand Rathi Wealth Structured Products personnel only.
          </p>
        </footer>
      </div>
    </AuthShell>
  );
}
