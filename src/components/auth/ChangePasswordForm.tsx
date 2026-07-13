"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";

type Props = {
  /** When true, auto-request OTP for the logged-in user. */
  fromDashboard?: boolean;
};

export function ChangePasswordForm({ fromDashboard = false }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(fromDashboard);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const storedOtp = sessionStorage.getItem("sp_otp_preview") || "";
      const storedEmail = sessionStorage.getItem("sp_login_email") || "";
      if (storedOtp) setOtp(storedOtp);
      if (storedEmail) setEmail(storedEmail);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!fromDashboard) return;

    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/request-password-otp", {
          method: "POST",
        });
        const data = await res.json();
        if (!alive) return;
        if (!res.ok) {
          setError(data.error || "Unable to generate code");
          setRequesting(false);
          return;
        }
        if (data.otp) {
          setOtp(data.otp);
          sessionStorage.setItem("sp_otp_preview", data.otp);
        }
        if (data.email) {
          setEmail(data.email);
          sessionStorage.setItem("sp_login_email", data.email);
        }
      } catch {
        if (alive) setError("Network error");
      } finally {
        if (alive) setRequesting(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [fromDashboard]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Update failed");
        setLoading(false);
        return;
      }
      sessionStorage.removeItem("sp_otp_preview");
      sessionStorage.removeItem("sp_login_email");
      setDone(true);
      setTimeout(() => router.push(data.redirect || "/login"), 1800);
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  return (
    <AuthShell subtitle="NEW PASSWORD" variant="recover">
      <div className="auth-card auth-card-premium w-full max-w-[480px] animate-rise">
        <div className="auth-card-accent" aria-hidden />
        <div className="relative">
          <div className="auth-icon-badge mb-5">
            <LockKeyhole size={22} strokeWidth={1.75} />
          </div>
          <p className="auth-eyebrow">Secure update</p>
          <h1 className="auth-title">Set new password</h1>
          <p className="auth-lead">
            {fromDashboard
              ? "A verification code was generated for your session."
              : "Use the code generated for your account."}
          </p>

          {requesting ? (
            <p className="mt-6 text-center text-sm text-[var(--fg-muted)]">
              Generating verification code…
            </p>
          ) : done ? (
            <p className="auth-success mt-6">
              Password updated. Redirecting to sign in…
            </p>
          ) : (
            <>
              {otp ? (
                <div className="auth-otp-display mt-6">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--fg-subtle)]">
                    Verification code
                    {email ? ` · ${email}` : ""}
                  </p>
                  <p className="auth-otp-code">{otp}</p>
                </div>
              ) : (
                <p className="auth-error mt-6">
                  No code available.{" "}
                  <Link href="/forgot-password" className="auth-link underline">
                    Request one
                  </Link>
                  .
                </p>
              )}

              <form onSubmit={onSubmit} className="mt-8 space-y-5">
                <div>
                  <label className="auth-label">Enter code</label>
                  <input
                    className="input-field auth-input auth-otp-input !text-left !text-lg !tracking-[0.3em]"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    required
                  />
                </div>
                <div>
                  <label className="auth-label">New password</label>
                  <input
                    className="input-field auth-input"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div>
                  <label className="auth-label">Confirm password</label>
                  <input
                    className="input-field auth-input"
                    type="password"
                    required
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>
                {error ? <p className="auth-error">{error}</p> : null}
                <button
                  type="submit"
                  className="btn-primary auth-submit w-full"
                  disabled={loading || code.length !== 6}
                >
                  {loading ? "Updating…" : "Update password"}
                  {!loading ? <ArrowRight size={16} /> : null}
                </button>
              </form>
            </>
          )}

          <p className="mt-6 text-center text-sm">
            <Link
              href={fromDashboard ? "/dashboard" : "/login"}
              className="auth-link"
            >
              ← {fromDashboard ? "Back to dashboard" : "Back to sign in"}
            </Link>
          </p>
        </div>
      </div>
    </AuthShell>
  );
}
