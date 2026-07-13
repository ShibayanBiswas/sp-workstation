"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";

type Props = {
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
      setLoading(false);
      setTimeout(() => router.push(data.redirect || "/login"), 1800);
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  return (
    <AuthShell subtitle="NEW PASSWORD" variant="recover">
      <div className="auth-card auth-card-large animate-rise">
        <div className="auth-card-accent" aria-hidden />

        <header className="auth-header">
          <div className="min-w-0 flex-1">
            <p className="auth-eyebrow">Secure update</p>
            <h1 className="auth-title">Set new password</h1>
            <p className="auth-lead">
              {fromDashboard
                ? "A verification code was generated for your active session. Enter it below with your new password."
                : "Use the verification code generated for your account, then choose a new password."}
            </p>
          </div>
          <div className="auth-icon-badge">
            <LockKeyhole size={24} strokeWidth={1.75} />
          </div>
        </header>

        <div className="auth-divider" />

        {!requesting && !done ? (
          <div className="auth-security-strip">
            <div>
              <span className="auth-mini-label">Password rule</span>
              <strong>Upper, lower, number</strong>
            </div>
            <div>
              <span className="auth-mini-label">Verification</span>
              <strong>6-digit OTP</strong>
            </div>
          </div>
        ) : null}

        {requesting ? (
          <p className="py-8 text-center text-base text-[var(--fg-muted)]">
            Generating verification code…
          </p>
        ) : done ? (
          <p className="auth-success my-6">
            Password updated. Redirecting to sign in…
          </p>
        ) : (
          <>
            {otp ? (
              <div className="auth-otp-panel">
                <p className="auth-otp-caption">
                  Verification code{email ? ` · ${email}` : ""}
                </p>
                <p className="auth-otp-code">{otp}</p>
              </div>
            ) : (
              <p className="auth-error">
                No code available.{" "}
                <Link href="/forgot-password" className="auth-link underline">
                  Request one
                </Link>
                .
              </p>
            )}

            <form onSubmit={onSubmit} className="auth-form mt-6">
              <div className="auth-field">
                <label className="auth-label" htmlFor="change-code">
                  Enter code
                </label>
                <input
                  id="change-code"
                  className="input-field auth-input auth-otp-input w-full !text-left !tracking-[0.28em]"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  required
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="auth-field">
                  <label className="auth-label" htmlFor="new-password">
                    New password
                  </label>
                  <input
                    id="new-password"
                    className="input-field auth-input w-full"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                  />
                </div>
                <div className="auth-field">
                  <label className="auth-label" htmlFor="confirm-password">
                    Confirm password
                  </label>
                  <input
                    id="confirm-password"
                    className="input-field auth-input w-full"
                    type="password"
                    required
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter password"
                  />
                </div>
              </div>

              {error ? <p className="auth-error">{error}</p> : null}

              <div className="auth-actions">
                <button
                  type="submit"
                  className="btn-primary auth-submit w-full"
                  disabled={loading || code.length !== 6}
                >
                  {loading ? "Updating…" : "Update password"}
                  {!loading ? <ArrowRight size={16} /> : null}
                </button>
              </div>
            </form>
          </>
        )}

        <footer className="auth-footer">
          <Link
            href={fromDashboard ? "/dashboard" : "/login"}
            className="auth-link auth-back"
          >
            ← {fromDashboard ? "Back to dashboard" : "Back to sign in"}
          </Link>
        </footer>
      </div>
    </AuthShell>
  );
}
