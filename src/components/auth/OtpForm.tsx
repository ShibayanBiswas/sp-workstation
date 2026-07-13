"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";

export function OtpForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setEmail(sessionStorage.getItem("sp_login_email") || "");
      setPreview(sessionStorage.getItem("sp_otp_preview") || "");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid OTP");
        setLoading(false);
        if (data.redirect) {
          setTimeout(() => router.push(data.redirect), 1200);
        }
        return;
      }
      sessionStorage.removeItem("sp_otp_preview");
      sessionStorage.removeItem("sp_login_email");
      router.push(data.redirect || "/dashboard");
    } catch {
      setError("Verification failed. Returning to login…");
      setLoading(false);
      setTimeout(() => router.push("/login"), 1200);
    }
  }

  return (
    <AuthShell subtitle="EMAIL VERIFICATION">
      <div className="auth-card w-full max-w-[460px] animate-rise">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[color-mix(in_srgb,var(--gold)_35%,var(--border))] bg-[color-mix(in_srgb,var(--gold)_10%,var(--bg-muted))] text-[var(--gold-deep)] dark:text-[var(--gold)]">
            <KeyRound size={24} />
          </div>
          <p className="section-kicker">Email verification</p>
          <h1
            className="mt-2 text-4xl text-[var(--fg)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Verify your email
          </h1>
          <p className="mt-3 text-sm text-[var(--fg-muted)]">
            Enter the 6-digit code sent to{" "}
            <span className="font-medium text-[var(--gold-deep)] dark:text-[var(--gold-soft)]">
              {email || "your email"}
            </span>
          </p>
        </div>

        {preview ? (
          <p className="mb-4 rounded-lg border border-[color-mix(in_srgb,var(--gold)_30%,var(--border))] bg-[color-mix(in_srgb,var(--gold)_10%,var(--bg-muted))] px-3 py-2 text-center text-xs text-[var(--gold-deep)] dark:text-[var(--gold-soft)]">
            Dev OTP: <strong className="tracking-[0.35em]">{preview}</strong>
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-5">
          <input
            className="input-field auth-input !text-center !text-2xl !tracking-[0.45em]"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="••••••"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            required
            autoFocus
          />
          {error ? (
            <p className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className="btn-primary auth-submit w-full"
            disabled={loading || code.length !== 6}
          >
            {loading ? "…" : "Verify"}
          </button>
        </form>
      </div>
    </AuthShell>
  );
}
