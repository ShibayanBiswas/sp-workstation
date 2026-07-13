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
      if (data.otpPreview) {
        sessionStorage.setItem("sp_otp_preview", data.otpPreview);
      }
      sessionStorage.setItem("sp_login_email", data.email || email);
      router.push("/otp");
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <AuthShell subtitle="STRUCTURED PRODUCTS">
      <div className="auth-card w-full max-w-[460px] animate-rise">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="section-kicker text-[var(--gold-deep)] dark:text-[var(--gold)]">
              Team sign in
            </p>
            <h1
              className="mt-2 text-4xl leading-tight text-[var(--fg)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Welcome back
            </h1>
            <p className="mt-3 border-l-2 border-[color-mix(in_srgb,var(--gold)_40%,transparent)] pl-4 text-sm leading-relaxed text-[var(--fg-muted)]">
              Secure desk access for Anand Rathi Wealth Structured Products —
              verified with email OTP.
            </p>
          </div>
          <div className="rounded-xl border border-[color-mix(in_srgb,var(--gold)_35%,var(--border))] bg-[color-mix(in_srgb,var(--gold)_8%,var(--bg-muted))] p-2.5 text-[var(--gold-deep)] dark:text-[var(--gold)]">
            <ShieldCheck size={20} />
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-[11px] font-semibold tracking-[0.16em] text-[var(--fg-muted)]">
              USER ID / EMAIL
            </label>
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
            <label className="mb-2 block text-[11px] font-semibold tracking-[0.16em] text-[var(--fg-muted)]">
              PASSWORD
            </label>
            <div className="relative">
              <input
                className="input-field auth-input pr-12"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)] hover:text-[var(--gold-deep)] dark:hover:text-[var(--gold)]"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error ? (
            <p className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2.5 text-sm text-red-700 dark:text-red-200">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
            <button
              type="submit"
              className="btn-primary auth-submit flex-1"
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign In"}
              {!loading ? <ArrowRight size={16} /> : null}
            </button>
            <Link href="/forgot-password" className="auth-link text-center text-sm">
              Forgot password?
            </Link>
          </div>
        </form>

        <p className="mt-8 text-center text-[11px] leading-relaxed text-[var(--fg-subtle)]">
          Authorised Anand Rathi Wealth Structured Products personnel only.
        </p>
      </div>
    </AuthShell>
  );
}
