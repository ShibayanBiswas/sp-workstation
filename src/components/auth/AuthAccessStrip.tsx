"use client";

import type { ReactNode } from "react";
import { Clock, KeyRound, ShieldCheck } from "lucide-react";

type Variant = "login" | "verify" | "password";

type Props = {
  variant?: Variant;
};

function Pill({ children }: { children: ReactNode }) {
  return <span className="auth-access-pill">{children}</span>;
}

export function AuthAccessStrip({ variant = "login" }: Props) {
  if (variant === "verify") {
    return (
      <div className="auth-access-strip">
        <div className="auth-access-icon auth-access-icon-lg" aria-hidden>
          <KeyRound size={22} strokeWidth={1.75} />
        </div>
        <div className="auth-access-body">
          <p className="auth-access-title">On-screen verification</p>
          <p className="auth-access-copy">
            Your 6-digit code appears in the panel below. Nothing is sent by
            email — enter it to complete sign-in.
          </p>
          <div className="auth-access-pills">
            <Pill>Local OTP</Pill>
            <Pill>10 min validity</Pill>
            <Pill>IST</Pill>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "password") {
    return (
      <div className="auth-access-strip">
        <div className="auth-access-icon auth-access-icon-lg" aria-hidden>
          <ShieldCheck size={22} strokeWidth={1.75} />
        </div>
        <div className="auth-access-body">
          <p className="auth-access-title">Secure password update</p>
          <p className="auth-access-copy">
            A verification code is generated on screen. No email delivery
            required.
          </p>
          <div className="auth-access-pills">
            <Pill>On-screen OTP</Pill>
            <Pill>Roster emails only</Pill>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-access-strip">
      <div className="auth-access-icon auth-access-icon-lg" aria-hidden>
        <ShieldCheck size={22} strokeWidth={1.75} />
      </div>
      <div className="auth-access-body">
        <p className="auth-access-title">Two-step secure access</p>
        <p className="auth-access-copy">
          Sign in with your credentials, then enter the verification code
          displayed on the next screen. Codes are generated locally — nothing is
          sent by email.
        </p>
        <div className="auth-access-pills">
          <Pill>
            <KeyRound size={12} className="inline shrink-0" />
            Credentials
          </Pill>
          <Pill>Local OTP</Pill>
          <Pill>SP Desk only</Pill>
          <Pill>
            <Clock size={12} className="inline shrink-0" />
            12h session
          </Pill>
        </div>
      </div>
    </div>
  );
}
