"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowRight, Mail } from "lucide-react";
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
      <div className="auth-card auth-card-premium w-full max-w-[480px] animate-rise">
        <div className="auth-card-accent" aria-hidden />
        <div className="relative">
          <div className="auth-icon-badge mb-5">
            <Mail size={22} strokeWidth={1.75} />
          </div>
          <p className="auth-eyebrow">Password update</p>
          <h1 className="auth-title">Change your password</h1>
          <p className="auth-lead">
            Enter your registered email. The system will generate a verification
            code on the next screen — no email delivery.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div>
              <label className="auth-label">Registered email</label>
              <input
                className="input-field auth-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@rathi.com"
              />
            </div>
            {error ? <p className="auth-error">{error}</p> : null}
            <button
              type="submit"
              className="btn-primary auth-submit w-full"
              disabled={loading}
            >
              {loading ? "Generating code…" : "Generate verification code"}
              {!loading ? <ArrowRight size={16} /> : null}
            </button>
          </form>

          <p className="mt-6 text-center text-sm">
            <Link href="/login" className="auth-link">
              ← Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </AuthShell>
  );
}
