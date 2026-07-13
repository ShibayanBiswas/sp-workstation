"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";

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
    <div className="login-atmosphere flex min-h-screen items-center justify-center px-6 py-12 text-[#f7f5f0]">
      <div className="w-full max-w-md rounded-2xl border border-[#d4b24c33] bg-[#111111]/92 p-8 backdrop-blur-xl animate-rise">
        <div className="mb-6 flex justify-center">
          <Image
            src="/brand/arwl-logo.png"
            alt="Anand Rathi Wealth"
            width={200}
            height={45}
            className="h-10 w-auto brightness-110"
          />
        </div>
        <h1
          className="text-center text-3xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Forgot password
        </h1>
        <p className="mt-2 text-center text-sm text-[#9d9d9d]">
          We will email a secure link to set a new password.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-xs tracking-[0.16em] text-[#c8c4bc]">
              REGISTERED EMAIL
            </label>
            <input
              className="input-field !bg-[#1a1a1a] !text-[#f7f5f0] !border-[#ffffff14]"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@rathi.com"
            />
          </div>
          {error ? (
            <p className="text-sm text-red-300">{error}</p>
          ) : null}
          {message ? (
            <p className="rounded-lg border border-[#d4b24c33] bg-[#d4b24c12] px-3 py-2 text-sm text-[#e5cf94]">
              {message}
            </p>
          ) : null}
          {preview ? (
            <p className="break-all text-xs text-[#9d9d9d]">
              Dev reset link:{" "}
              <a className="text-[#e5cf94] underline" href={preview}>
                {preview}
              </a>
            </p>
          ) : null}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="text-[#e5cf94] hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
