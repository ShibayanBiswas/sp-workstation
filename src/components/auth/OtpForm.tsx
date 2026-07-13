"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, KeyRound } from "lucide-react";
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
      router.push(data.redirect || "/dashboard");
    } catch {
      setError("Verification failed. Returning to login…");
      setLoading(false);
      setTimeout(() => router.push("/login"), 1200);
    }
  }

  return (
    <AuthShell subtitle="VERIFICATION" variant="verify">
      <div className="auth-card auth-card-premium w-full max-w-[480px] animate-rise">
        <div className="auth-card-accent" aria-hidden />
        <div className="relative text-center">
          <div className="auth-icon-badge mx-auto mb-5 h-16 w-16">
            <KeyRound size={28} strokeWidth={1.75} />
          </div>
          <p className="auth-eyebrow">Step 2 of 2</p>
          <h1 className="auth-title">Verify access</h1>
          <p className="auth-lead mx-auto max-w-sm">
            Enter the 6-digit code generated for{" "}
            <span className="font-semibold text-[var(--gold-deep)] dark:text-[var(--gold-soft)]">
              {email || "your account"}
            </span>
          </p>

          {otp ? (
            <div className="auth-otp-display mt-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--fg-subtle)]">
                Your verification code
              </p>
              <p className="auth-otp-code">{otp}</p>
              <p className="mt-2 text-[11px] text-[var(--fg-subtle)]">
                Valid for 10 minutes · IST
              </p>
            </div>
          ) : (
            <p className="auth-error mt-6">
              Code unavailable. Return to sign in and try again.
            </p>
          )}

          <form onSubmit={onSubmit} className="mt-8 space-y-5 text-left">
            <div>
              <label className="auth-label text-center">Enter code</label>
              <input
                className="input-field auth-input auth-otp-input"
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
            <button
              type="submit"
              className="btn-primary auth-submit w-full"
              disabled={loading || code.length !== 6}
            >
              {loading ? "Verifying…" : "Enter workstation"}
              {!loading ? <ArrowRight size={16} /> : null}
            </button>
          </form>

          <p className="mt-6 text-sm">
            <Link href="/login" className="auth-link">
              ← Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </AuthShell>
  );
}
