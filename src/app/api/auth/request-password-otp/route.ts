import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/User";
import { Otp } from "@/lib/models/Otp";
import {
  generateOtp,
  createPendingToken,
  setPendingCookie,
  getSession,
} from "@/lib/auth";

/** Logged-in users: generate a local OTP before changing password. */
export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
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

    const pending = await createPendingToken({
      userId: String(user._id),
      email: user.email,
      name: user.name,
      purpose: "password_reset",
    });
    await setPendingCookie(pending);

    return NextResponse.json({
      ok: true,
      message: "Verification code generated. Valid for 10 minutes.",
      email: user.email,
      otp: code,
    });
  } catch (err) {
    console.error("Request password OTP error:", err);
    return NextResponse.json(
      { error: "Unable to generate verification code." },
      { status: 500 }
    );
  }
}
