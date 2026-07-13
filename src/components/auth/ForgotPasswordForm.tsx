"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    setPreview("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Request failed");
      } else {
        setMessage(data.message);
        if (data.resetPreview) setPreview(data.resetPreview);
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell subtitle="PASSWORD RECOVERY">
      <div className="auth-card w-full max-w-[460px] animate-rise">
        <p className="section-kicker text-center text-[var(--gold-deep)] dark:text-[var(--gold)]">
          Password recovery
        </p>
        <h1
          className="mt-2 text-center text-4xl text-[var(--fg)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Forgot password
        </h1>
        <p className="mt-3 text-center text-sm leading-relaxed text-[var(--fg-muted)]">
          We will email a secure link to set a new password.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-[11px] font-semibold tracking-[0.16em] text-[var(--fg-muted)]">
              REGISTERED EMAIL
            </label>
            <input
              className="input-field auth-input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@rathi.com"
            />
          </div>
          {error ? (
            <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
          ) : null}
          {message ? (
            <p className="rounded-lg border border-[color-mix(in_srgb,var(--gold)_30%,var(--border))] bg-[color-mix(in_srgb,var(--gold)_10%,var(--bg-muted))] px-3 py-2 text-sm text-[var(--gold-deep)] dark:text-[var(--gold-soft)]">
              {message}
            </p>
          ) : null}
          {preview ? (
            <p className="break-all text-xs text-[var(--fg-subtle)]">
              Dev reset link:{" "}
              <a className="auth-link underline" href={preview}>
                {preview}
              </a>
            </p>
          ) : null}
          <button
            type="submit"
            className="btn-primary auth-submit w-full"
            disabled={loading}
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="auth-link">
            Back to sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
