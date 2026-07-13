"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      <div className="auth-card auth-card-premium w-full max-w-[480px] animate-rise">
        <div className="auth-card-accent" aria-hidden />
        <div className="relative">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <p className="auth-eyebrow">Structured Products Desk</p>
              <h1 className="auth-title">Welcome back</h1>
              <p className="auth-lead">
                Anand Rathi Wealth internal workstation. Sign in with your team
                credentials — verification uses a system-generated code.
              </p>
            </div>
            <div className="auth-icon-badge">
              <ShieldCheck size={22} strokeWidth={1.75} />
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="auth-label">User ID / Email</label>
              <input
                className="input-field auth-input"
                type="email"
                autoComplete="username"
                placeholder="name@rathi.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="auth-label">Password</label>
              <div className="relative">
                <input
                  className="input-field auth-input pr-12"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)] transition hover:text-[var(--gold-deep)] dark:hover:text-[var(--gold)]"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error ? <p className="auth-error">{error}</p> : null}

            <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
              <button
                type="submit"
                className="btn-primary auth-submit flex-1"
                disabled={loading}
              >
                {loading ? "Authenticating…" : "Continue"}
                {!loading ? <ArrowRight size={16} /> : null}
              </button>
              <Link
                href="/forgot-password"
                className="auth-link text-center text-sm"
              >
                Change password
              </Link>
            </div>
          </form>

          <p className="auth-footnote">
            Authorised Anand Rathi Wealth Structured Products personnel only.
          </p>
        </div>
      </div>
    </AuthShell>
  );
}
