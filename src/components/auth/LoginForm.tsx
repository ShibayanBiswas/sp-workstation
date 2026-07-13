"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Eye, EyeOff, ArrowRight, ShieldCheck } from "lucide-react";

const CONTACT = {
  phone: "1800 210 1000",
  email: "wealth@rathi.com",
  address: "Express Zone, A-Wing, 10th Floor, Western Express Highway, Goregaon (E), Mumbai – 400063",
};

const VALUES = [
  { title: "Fearless Approach", copy: "Show the information that matters — without fear." },
  { title: "Uncomplicated", copy: "Clarity before every structured-product decision." },
  { title: "Backed by Data", copy: "Desk intelligence at scale for considered calls." },
  { title: "Transparency", copy: "Transparency = Trust = Implementation." },
];

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
    <div className="login-atmosphere relative min-h-screen overflow-hidden text-[#f7f5f0]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(229,207,148,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(229,207,148,0.35) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 md:px-10">
        <div className="flex items-center gap-4 animate-rise">
          <Image
            src="/brand/arwl-logo.png"
            alt="Anand Rathi Wealth"
            width={220}
            height={50}
            className="h-10 w-auto brightness-110 md:h-12"
            priority
          />
        </div>
        <div className="hidden items-center gap-6 text-sm text-[#c8c4bc] md:flex animate-rise-delay-1">
          <span>Structured Products · Internal</span>
          <span className="h-4 w-px bg-[#d4b24c55]" />
          <span>{CONTACT.phone}</span>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid max-w-7xl gap-12 px-6 pb-16 pt-4 md:grid-cols-[1.15fr_0.85fr] md:px-10 md:pt-10 lg:gap-16">
        <section className="flex flex-col justify-center">
          <p className="animate-rise text-xs font-semibold tracking-[0.32em] text-[#d4b24c]">
            YOUR CFO FOR PERSONAL WEALTH
          </p>
          <h1
            className="animate-rise-delay-1 mt-4 max-w-xl text-4xl leading-[1.1] text-[#f7f5f0] md:text-5xl lg:text-6xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Structured Products
            <span className="gold-text"> Workstation</span>
          </h1>
          <p className="animate-rise-delay-2 mt-5 max-w-lg text-base leading-relaxed text-[#c8c4bc] md:text-lg">
            Secure access for the Anand Rathi Wealth Structured Products team —
            desk intelligence, portfolio clarity, and market context in one
            elegant terminal.
          </p>

          <div className="animate-rise-delay-3 mt-10 grid gap-4 sm:grid-cols-2">
            {VALUES.map((v) => (
              <div
                key={v.title}
                className="rounded-xl border border-[#d4b24c22] bg-white/[0.03] p-4 backdrop-blur-sm"
              >
                <h3
                  className="text-lg text-[#e5cf94]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {v.title}
                </h3>
                <p className="mt-1 text-sm text-[#9d9d9d]">{v.copy}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 space-y-3 border-t border-[#d4b24c22] pt-8 text-sm text-[#9d9d9d]">
            <p className="tracking-[0.18em] text-[11px] uppercase text-[#d4b24c]">
              Contact
            </p>
            <p>{CONTACT.phone}</p>
            <p>{CONTACT.email}</p>
            <p className="max-w-md leading-relaxed">{CONTACT.address}</p>
          </div>
        </section>

        <section className="animate-rise-delay-2 flex items-center">
          <div className="w-full rounded-2xl border border-[#d4b24c33] bg-[#111111]/92 backdrop-blur-xl p-7 shadow-[0_30px_80px_rgba(0,0,0,0.45)] md:p-9">
            <div className="mb-7 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs tracking-[0.28em] text-[#d4b24c]">
                  TEAM SIGN IN
                </p>
                <h2
                  className="mt-2 text-3xl text-[#f7f5f0]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Welcome back
                </h2>
                <p className="mt-2 text-sm text-[#9d9d9d]">
                  Enter your credentials. Email OTP verification follows.
                </p>
              </div>
              <div className="rounded-full border border-[#d4b24c44] p-2.5 text-[#d4b24c]">
                <ShieldCheck size={20} />
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-xs tracking-[0.16em] text-[#c8c4bc]">
                  USER ID / EMAIL
                </label>
                <input
                  className="input-field !bg-[#1a1a1a] !text-[#f7f5f0] !border-[#ffffff14]"
                  type="email"
                  autoComplete="username"
                  placeholder="name@rathi.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-xs tracking-[0.16em] text-[#c8c4bc]">
                  PASSWORD
                </label>
                <div className="relative">
                  <input
                    className="input-field !bg-[#1a1a1a] !text-[#f7f5f0] !border-[#ffffff14] pr-12"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9d9d9d] hover:text-[#e5cf94]"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error ? (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {error}
                </p>
              ) : null}

              <div className="flex items-center gap-4 pt-1">
                <button type="submit" className="btn-primary flex-1" disabled={loading}>
                  {loading ? "Signing in…" : "Sign In"}
                  {!loading ? <ArrowRight size={16} /> : null}
                </button>
                <Link
                  href="/forgot-password"
                  className="whitespace-nowrap text-sm text-[#e5cf94] underline-offset-4 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
            </form>

            <p className="mt-8 text-center text-[11px] leading-relaxed text-[#767676]">
              Authorised personnel only. Activity may be monitored for security
              and compliance.
            </p>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-[#d4b24c18] px-6 py-5 text-center text-xs text-[#767676] md:px-10">
        © {new Date().getFullYear()} Anand Rathi Wealth Limited · Structured
        Products Team Workstation
      </footer>
    </div>
  );
}
