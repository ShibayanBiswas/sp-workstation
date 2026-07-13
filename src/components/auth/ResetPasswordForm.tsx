"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";

function ResetInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Reset failed");
        setLoading(false);
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 1800);
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  return (
    <div className="auth-card w-full max-w-[460px] animate-rise">
      <p className="section-kicker text-center text-[var(--gold-deep)] dark:text-[var(--gold)]">
        New credentials
      </p>
      <h1
        className="mt-2 text-center text-4xl text-[var(--fg)]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Set new password
      </h1>
      {!token ? (
        <p className="mt-4 text-center text-sm text-red-600 dark:text-red-300">
          Missing reset token. Request a new link from{" "}
          <Link href="/forgot-password" className="auth-link underline">
            forgot password
          </Link>
          .
        </p>
      ) : done ? (
        <p className="mt-6 text-center text-sm text-[var(--gold-deep)] dark:text-[var(--gold-soft)]">
          Password updated. Redirecting to sign in…
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-[11px] font-semibold tracking-[0.16em] text-[var(--fg-muted)]">
              NEW PASSWORD
            </label>
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
            <label className="mb-2 block text-[11px] font-semibold tracking-[0.16em] text-[var(--fg-muted)]">
              CONFIRM PASSWORD
            </label>
            <input
              className="input-field auth-input"
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {error ? (
            <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
          ) : null}
          <button
            type="submit"
            className="btn-primary auth-submit w-full"
            disabled={loading}
          >
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>
      )}
    </div>
  );
}

export function ResetPasswordForm() {
  return (
    <AuthShell subtitle="RESET PASSWORD">
      <Suspense
        fallback={
          <div className="text-[var(--gold-deep)] dark:text-[var(--gold)]">
            Loading…
          </div>
        }
      >
        <ResetInner />
      </Suspense>
    </AuthShell>
  );
}
