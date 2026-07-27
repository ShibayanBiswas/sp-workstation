"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { AuthAccessStrip } from "@/components/auth/AuthAccessStrip";
import { AuthOtpDisplay } from "@/components/auth/AuthOtpDisplay";
import { AuthShell } from "@/components/auth/AuthShell";

type Props = {
  fromDashboard?: boolean;
};

function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must include an uppercase letter.";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must include a lowercase letter.";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must include a number.";
  }
  return null;
}

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
  const redirectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const storedOtp = sessionStorage.getItem("sp_otp_preview") || "";
      const storedEmail = sessionStorage.getItem("sp_login_email") || "";
      if (storedOtp) {
        setOtp(storedOtp);
        setCode(storedOtp.replace(/\D/g, "").slice(0, 6));
      }
      if (storedEmail) setEmail(storedEmail);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (redirectTimerRef.current != null) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!fromDashboard) return;

    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/request-password-otp", {
          method: "POST",
          credentials: "include",
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
          setCode(String(data.otp).replace(/\D/g, "").slice(0, 6));
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
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
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
      if (redirectTimerRef.current != null) {
        window.clearTimeout(redirectTimerRef.current);
      }
      redirectTimerRef.current = window.setTimeout(() => {
        router.push(data.redirect || "/login");
      }, 1800);
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  return (
    <AuthShell subtitle="NEW PASSWORD" variant="recover">
      <div className="auth-card auth-card-large animate-rise auth-card-alive">
        <div className="auth-card-accent" aria-hidden />

        <header className="auth-header">
          <div className="min-w-0 flex-1">
            <p className="auth-eyebrow">Structured Products Desk</p>
            <h1 className="auth-title">Set new password</h1>
            <p className="auth-lead">
              {fromDashboard
                ? "A verification code was generated for your active session. Enter it below with your new password."
                : email
                  ? `Use the verification code for ${email}, then choose a new password.`
                  : "Use the verification code generated for your account, then choose a new password."}
            </p>
          </div>
          <div className="auth-icon-badge">
            <LockKeyhole size={24} strokeWidth={1.75} />
          </div>
        </header>

        <div className="auth-divider" />

        {!requesting && !done ? <AuthAccessStrip variant="password" /> : null}

        {requesting ? (
          <p className="auth-loading-note">Generating verification code…</p>
        ) : done ? (
          <p className="auth-success my-6" role="status">
            Password updated. Redirecting to sign in…
          </p>
        ) : (
          <div className="auth-verify-zone">
            {otp ? (
              <AuthOtpDisplay otp={otp} caption="Verification code" />
            ) : (
              <p className="auth-error" role="alert">
                No code available.{" "}
                <Link href="/forgot-password" className="auth-link underline">
                  Request one
                </Link>
                .
              </p>
            )}

            <form onSubmit={onSubmit} className="auth-form">
              <div className="auth-field">
                <label className="auth-label" htmlFor="change-code">
                  Enter code
                </label>
                <input
                  id="change-code"
                  className="input-field auth-input auth-otp-input w-full"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
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
                    autoComplete="new-password"
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
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter password"
                  />
                </div>
              </div>

              {error ? (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="auth-actions">
                <button
                  type="submit"
                  className="btn-primary auth-submit w-full"
                  disabled={loading || code.length !== 6 || !otp}
                >
                  {loading ? "Updating…" : "Update password"}
                  {!loading ? <ArrowRight size={16} /> : null}
                </button>
              </div>
            </form>
          </div>
        )}

        <footer className="auth-footer">
          <Link
            href={fromDashboard ? "/dashboard" : "/login"}
            className="auth-link auth-back"
          >
            ← {fromDashboard ? "Back to dashboard" : "Back to sign in"}
          </Link>
          <p className="auth-footnote mt-4">
            Password must include upper, lower case, and a number.
          </p>
        </footer>
      </div>
    </AuthShell>
  );
}
