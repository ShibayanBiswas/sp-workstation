"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { KeyRound } from "lucide-react";

export function OtpForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setEmail(sessionStorage.getItem("sp_login_email") || "");
    setPreview(sessionStorage.getItem("sp_otp_preview") || "");
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
        sessionStorage.removeItem("sp_otp_preview");
        sessionStorage.removeItem("sp_login_email");
        setTimeout(() => router.push(data.redirect || "/login"), 1200);
        return;
      }
      sessionStorage.removeItem("sp_otp_preview");
      sessionStorage.removeItem("sp_login_email");
      router.push(data.redirect || "/dashboard");
    } catch {
      setError("Verification failed. Returning to login…");
      setTimeout(() => router.push("/login"), 1200);
    }
  }

  return (
    <div className="login-atmosphere flex min-h-screen items-center justify-center px-6 py-12 text-[#f7f5f0]">
      <div className="w-full max-w-md rounded-2xl border border-[#d4b24c33] bg-[#111111]/92 p-8 backdrop-blur-xl shadow-[0_30px_80px_rgba(0,0,0,0.45)] animate-rise">
        <div className="mb-6 flex justify-center">
          <Image
            src="/brand/arwl-logo.png"
            alt="Anand Rathi Wealth"
            width={200}
            height={45}
            className="h-10 w-auto brightness-110"
          />
        </div>
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#d4b24c44] text-[#d4b24c]">
            <KeyRound size={22} />
          </div>
          <h1
            className="text-3xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Email verification
          </h1>
          <p className="mt-2 text-sm text-[#9d9d9d]">
            Enter the 6-digit OTP sent to{" "}
            <span className="text-[#e5cf94]">{email || "your email"}</span>
          </p>
        </div>

        {preview ? (
          <p className="mb-4 rounded-lg border border-[#d4b24c33] bg-[#d4b24c12] px-3 py-2 text-center text-xs text-[#e5cf94]">
            Dev preview OTP: <strong className="tracking-[0.3em]">{preview}</strong>
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-5">
          <input
            className="input-field !bg-[#1a1a1a] !text-center !text-2xl !tracking-[0.45em] !text-[#f7f5f0] !border-[#ffffff14]"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            required
            autoFocus
          />
          {error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}
          <button type="submit" className="btn-primary w-full" disabled={loading || code.length !== 6}>
            {loading ? "Verifying…" : "Verify & Continue"}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-[#767676]">
          Wrong OTP returns you to the login page for security.
        </p>
      </div>
    </div>
  );
}
