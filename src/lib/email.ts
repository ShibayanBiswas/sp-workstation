import nodemailer from "nodemailer";

const isDevMode = () =>
  process.env.EMAIL_DEV_MODE === "true" || !process.env.SMTP_USER;

function brandWrapper(title: string, bodyHtml: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#171717;border:1px solid #d4b24c55;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:28px 32px;border-bottom:1px solid #d4b24c33;">
          <div style="color:#d4b24c;letter-spacing:0.28em;font-size:11px;font-family:system-ui,sans-serif;">ANAND RATHI</div>
          <div style="color:#f7f5f0;font-size:22px;margin-top:6px;">Structured Products Workstation</div>
        </td></tr>
        <tr><td style="padding:32px;color:#f1f1f1;">
          <h1 style="margin:0 0 16px;font-size:20px;color:#e5cf94;">${title}</h1>
          ${bodyHtml}
          <p style="margin:28px 0 0;font-size:12px;color:#999;font-family:system-ui,sans-serif;">
            Anand Rathi Wealth — Structured Products Team. If you did not request this, ignore this email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function getTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export type MailResult = {
  sent: boolean;
  preview?: string;
  error?: string;
};

export async function sendOtpEmail(
  to: string,
  name: string,
  code: string
): Promise<MailResult> {
  const html = brandWrapper(
    "Your sign-in verification code",
    `<p style="margin:0 0 12px;font-family:system-ui,sans-serif;line-height:1.6;color:#ddd;">
      Hello ${name},
    </p>
    <p style="margin:0 0 20px;font-family:system-ui,sans-serif;line-height:1.6;color:#ddd;">
      Use this one-time password to complete sign-in to the SP Workstation. It expires in <strong>10 minutes</strong>.
    </p>
    <div style="letter-spacing:0.35em;font-size:32px;font-weight:700;color:#111;background:linear-gradient(135deg,#e5cf94,#d4b24c);padding:16px 24px;border-radius:8px;text-align:center;font-family:system-ui,sans-serif;">
      ${code}
    </div>`
  );

  const transporter = await getTransporter();
  if (!transporter) {
    console.info(`[SP Workstation] OTP for ${to}: ${code}`);
    return {
      sent: false,
      preview: isDevMode() ? code : undefined,
      error: "SMTP not configured",
    };
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: `${code} — SP Workstation verification code`,
      html,
    });
    return {
      sent: true,
      preview: isDevMode() ? code : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Email failed";
    console.error("OTP email failed:", message);
    console.info(`[SP Workstation] OTP for ${to}: ${code}`);
    return {
      sent: false,
      preview: isDevMode() ? code : undefined,
      error: message,
    };
  }
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetUrl: string
): Promise<MailResult> {
  const html = brandWrapper(
    "Reset your password",
    `<p style="margin:0 0 12px;font-family:system-ui,sans-serif;line-height:1.6;color:#ddd;">
      Hello ${name},
    </p>
    <p style="margin:0 0 20px;font-family:system-ui,sans-serif;line-height:1.6;color:#ddd;">
      We received a request to reset your SP Workstation password. This link expires in <strong>30 minutes</strong>.
    </p>
    <p style="text-align:center;margin:24px 0;">
      <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#e5cf94,#d4b24c);color:#111;text-decoration:none;padding:14px 28px;border-radius:8px;font-family:system-ui,sans-serif;font-weight:700;letter-spacing:0.04em;">
        Update Password
      </a>
    </p>
    <p style="margin:0;font-size:12px;color:#888;font-family:system-ui,sans-serif;word-break:break-all;">
      Or paste this link: ${resetUrl}
    </p>`
  );

  const transporter = await getTransporter();
  if (!transporter) {
    console.info(`[SP Workstation] Password reset for ${to}: ${resetUrl}`);
    return {
      sent: false,
      preview: isDevMode() ? resetUrl : undefined,
      error: "SMTP not configured",
    };
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: "Reset your SP Workstation password",
      html,
    });
    return {
      sent: true,
      preview: isDevMode() ? resetUrl : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Email failed";
    console.error("Reset email failed:", message);
    console.info(`[SP Workstation] Password reset for ${to}: ${resetUrl}`);
    return {
      sent: false,
      preview: isDevMode() ? resetUrl : undefined,
      error: message,
    };
  }
}
