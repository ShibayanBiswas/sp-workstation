import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/User";
import { Otp } from "@/lib/models/Otp";
import {
  verifyPassword,
  generateOtp,
  createPendingToken,
  setPendingCookie,
} from "@/lib/auth";
import { sendOtpEmail } from "@/lib/email";
import { seedTeamMembers } from "@/lib/seed";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Enter a valid email and password." },
        { status: 400 }
      );
    }

    await connectDB();

    // Auto-seed empty database so first deploy works
    const count = await User.countDocuments();
    if (count === 0) {
      await seedTeamMembers();
    }

    const email = parsed.data.email.toLowerCase().trim();
    const user = await User.findOne({ email });
    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const ok = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await Otp.deleteMany({ userId: user._id, consumed: false });
    await Otp.create({
      userId: user._id,
      email: user.email,
      code,
      expiresAt,
    });

    const mail = await sendOtpEmail(user.email, user.name, code);

    const pending = await createPendingToken({
      userId: String(user._id),
      email: user.email,
      name: user.name,
      purpose: "login",
    });
    await setPendingCookie(pending);

    return NextResponse.json({
      ok: true,
      message: mail.sent
        ? "OTP sent to your registered email."
        : "OTP generated. Check your email (or use the preview in development).",
      email: user.email,
      otpPreview: mail.preview,
      emailSent: mail.sent,
    });
  } catch (err) {
    console.error("Login error:", err);
    const message =
      err instanceof Error ? err.message : "Unable to sign in right now.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
