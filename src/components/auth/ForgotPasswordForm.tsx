"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { AuthDisclaimerModal } from "@/components/auth/AuthDisclaimerModal";
import { AuthAccessStrip } from "@/components/auth/AuthAccessStrip";
import { AuthShell } from "@/components/auth/AuthShell";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Request failed");
        setLoading(false);
        return;
      }
      if (data.otp) {
        sessionStorage.setItem("sp_otp_preview", data.otp);
        sessionStorage.setItem("sp_login_email", data.email || email);
        router.push(data.redirect || "/change-password");
        return;
      }
      setError(
        "If this email is registered, return to sign in or contact your admin."
      );
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell subtitle="PASSWORD" variant="recover">
      <div className="auth-card auth-card-large animate-rise">
        <div className="auth-card-accent" aria-hidden />

        <header className="auth-header">
          <div className="min-w-0 flex-1">
            <p className="auth-eyebrow">Structured Products Desk</p>
            <h1 className="auth-title">Change your password</h1>
            <p className="auth-lead">
              Enter your registered email address. The system will generate a
              verification code on the next screen — no email delivery required.
            </p>
          </div>
          <div className="auth-icon-badge">
            <Mail size={24} strokeWidth={1.75} />
          </div>
        </header>

        <div className="auth-divider" />

        <AuthAccessStrip variant="password" />

        <form onSubmit={onSubmit} className="auth-form">
          <div className="auth-field">
            <label className="auth-label" htmlFor="forgot-email">
              Registered email
            </label>
            <input
              id="forgot-email"
              className="input-field auth-input w-full"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@rathi.com"
            />
          </div>

          {error ? <p className="auth-error">{error}</p> : null}

          {error === "Invalid email ID." ? (
            <AuthDisclaimerModal
              title="Invalid email ID"
              message="Password changes are available only for approved Anand Rathi Wealth Structured Products email IDs."
              onClose={() => setError("")}
            />
          ) : null}

          <div className="auth-actions">
            <button
              type="submit"
              className="btn-primary auth-submit w-full"
              disabled={loading}
            >
              {loading ? "Generating code…" : "Generate verification code"}
              {!loading ? <ArrowRight size={16} /> : null}
            </button>
          </div>
        </form>

        <footer className="auth-footer">
          <Link href="/login" className="auth-link auth-back">
            ← Back to sign in
          </Link>
          <p className="auth-footnote mt-4">
            Only approved Structured Products email IDs can reset passwords.
          </p>
        </footer>
      </div>
    </AuthShell>
  );
}
