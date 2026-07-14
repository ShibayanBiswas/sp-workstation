"use client";

type Props = {
  otp: string;
  caption?: string;
};

/** Displays the system-generated OTP in a compact, wide panel. */
export function AuthOtpDisplay({ otp, caption = "Your verification code" }: Props) {
  return (
    <div className="auth-otp-panel">
      <p className="auth-otp-caption">{caption}</p>
      <p className="auth-otp-code" aria-label="Verification code">
        {otp}
      </p>
      <p className="auth-otp-meta">Valid for 10 minutes · IST</p>
    </div>
  );
}
