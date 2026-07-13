import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/User";
import { Otp } from "@/lib/models/Otp";
import {
  hashPassword,
  getPending,
  clearAuthCookies,
  clearPendingCookie,
} from "@/lib/auth";

const schema = z.object({
  code: z.string().length(6),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Must include an uppercase letter")
    .regex(/[a-z]/, "Must include a lowercase letter")
    .regex(/[0-9]/, "Must include a number"),
});

export async function POST(request: Request) {
  try {
    const pending = await getPending();
    if (!pending || pending.purpose !== "password_reset") {
      return NextResponse.json(
        {
          error: "Session expired. Request a new verification code.",
          redirect: "/login",
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ||
            "Password must be at least 8 characters with upper, lower, and a number.",
        },
        { status: 400 }
      );
    }

    await connectDB();
    const record = await Otp.findOne({
      userId: pending.userId,
      consumed: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!record || record.code !== parsed.data.code) {
      return NextResponse.json(
        { error: "Incorrect verification code. Please try again." },
        { status: 401 }
      );
    }

    const user = await User.findById(pending.userId);
    if (!user) {
      await clearAuthCookies();
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    user.passwordHash = await hashPassword(parsed.data.password);
    await user.save();

    record.consumed = true;
    await record.save();

    await clearAuthCookies();
    await clearPendingCookie();

    return NextResponse.json({
      ok: true,
      message: "Password updated. Sign in with your new password.",
      redirect: "/login",
    });
  } catch (err) {
    console.error("Change password error:", err);
    return NextResponse.json(
      { error: "Unable to update password." },
      { status: 500 }
    );
  }
}
