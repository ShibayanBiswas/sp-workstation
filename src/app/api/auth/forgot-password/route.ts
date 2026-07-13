import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/User";
import { PasswordReset } from "@/lib/models/PasswordReset";
import { generateResetToken } from "@/lib/auth";
import { resolveLoginEmail } from "@/lib/email-aliases";
import { sendPasswordResetEmail } from "@/lib/email";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 }
      );
    }

    await connectDB();
    const email = resolveLoginEmail(parsed.data.email);
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.findOne({
        email: parsed.data.email.toLowerCase().trim(),
      });
    }

    // Always return success message to avoid email enumeration
    const generic = {
      ok: true,
      message:
        "If this email is registered, a password reset link has been sent.",
    };

    if (!user) {
      return NextResponse.json(generic);
    }

    const token = generateResetToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await PasswordReset.deleteMany({ userId: user._id, consumed: false });
    await PasswordReset.create({
      userId: user._id,
      email: user.email,
      token,
      expiresAt,
    });

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password?token=${token}`;
    const mail = await sendPasswordResetEmail(user.email, user.name, resetUrl);

    return NextResponse.json({
      ...generic,
      resetPreview: mail.preview,
      emailSent: mail.sent,
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    return NextResponse.json(
      { error: "Unable to process request." },
      { status: 500 }
    );
  }
}
