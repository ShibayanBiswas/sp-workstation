"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

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
        Set new password
      </h1>
      {!token ? (
        <p className="mt-4 text-center text-sm text-red-300">
          Missing reset token. Request a new link from{" "}
          <Link href="/forgot-password" className="underline">
            forgot password
          </Link>
          .
        </p>
      ) : done ? (
        <p className="mt-6 text-center text-sm text-[#e5cf94]">
          Password updated. Redirecting to sign in…
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-xs tracking-[0.16em] text-[#c8c4bc]">
              NEW PASSWORD
            </label>
            <input
              className="input-field !bg-[#1a1a1a] !text-[#f7f5f0] !border-[#ffffff14]"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-2 block text-xs tracking-[0.16em] text-[#c8c4bc]">
              CONFIRM PASSWORD
            </label>
            <input
              className="input-field !bg-[#1a1a1a] !text-[#f7f5f0] !border-[#ffffff14]"
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>
      )}
    </div>
  );
}

export function ResetPasswordForm() {
  return (
    <div className="login-atmosphere flex min-h-screen items-center justify-center px-6 py-12 text-[#f7f5f0]">
      <Suspense fallback={<div className="text-[#e5cf94]">Loading…</div>}>
        <ResetInner />
      </Suspense>
    </div>
  );
}
