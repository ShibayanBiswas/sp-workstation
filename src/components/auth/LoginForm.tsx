"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { AuthDisclaimerModal } from "@/components/auth/AuthDisclaimerModal";
import { AuthShell } from "@/components/auth/AuthShell";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const noticeTitle = error.toLowerCase().includes("password")
    ? "Wrong password"
    : "Invalid email ID";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sign-in failed");
        setLoading(false);
        return;
      }
      if (data.otp) {
        sessionStorage.setItem("sp_otp_preview", data.otp);
      }
      sessionStorage.setItem("sp_login_email", data.email || email);
      router.push("/otp");
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <AuthShell subtitle="SECURE ACCESS" variant="signin">
      <div className="auth-card auth-card-large animate-rise">
        <div className="auth-card-accent" aria-hidden />

        <header className="auth-header">
          <div className="min-w-0 flex-1">
            <p className="auth-eyebrow">Structured Products Desk</p>
            <h1 className="auth-title">Welcome back</h1>
            <p className="auth-lead">
              Anand Rathi Wealth internal workstation. Sign in with your
              credentials, then enter the system-generated verification code on
              the next screen.
            </p>
          </div>
          <div className="auth-icon-badge">
            <ShieldCheck size={24} strokeWidth={1.75} />
          </div>
        </header>

        <div className="auth-divider" />

        <div className="auth-security-strip">
          <div>
            <span className="auth-mini-label">Access mode</span>
            <strong>Credentials + local OTP</strong>
          </div>
          <div>
            <span className="auth-mini-label">Scope</span>
            <strong>Structured Products only</strong>
          </div>
          <div>
            <span className="auth-mini-label">Session</span>
            <strong>12-hour secure token</strong>
          </div>
        </div>

        <form onSubmit={onSubmit} className="auth-form">
          <div className="auth-field">
            <label className="auth-label" htmlFor="login-email">
              User ID / Email
            </label>
            <input
              id="login-email"
              className="input-field auth-input w-full"
              type="email"
              autoComplete="username"
              placeholder="name@rathi.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="login-password">
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                className="input-field auth-input w-full pr-12"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)] transition hover:text-[var(--gold-deep)] dark:hover:text-[var(--gold)]"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error ? <p className="auth-error">{error}</p> : null}

          {error ? (
            <AuthDisclaimerModal
              title={noticeTitle}
              message={
                error.toLowerCase().includes("password")
                  ? "The email ID is valid, but the password does not match our records. Please re-enter your password or use Change password."
                  : "This workstation accepts only approved Anand Rathi Wealth Structured Products email IDs."
              }
              onClose={() => setError("")}
            />
          ) : null}

          <div className="auth-actions auth-actions-row">
            <button
              type="submit"
              className="btn-primary auth-submit w-full sm:w-auto sm:min-w-[220px]"
              disabled={loading}
            >
              {loading ? "Authenticating…" : "Continue"}
              {!loading ? <ArrowRight size={16} /> : null}
            </button>
            <Link href="/forgot-password" className="auth-link text-center">
              Change password
            </Link>
          </div>
        </form>

        <footer className="auth-footer">
          <p className="auth-footnote">
            Authorised Anand Rathi Wealth Structured Products personnel only.
          </p>
        </footer>
      </div>
    </AuthShell>
  );
}
