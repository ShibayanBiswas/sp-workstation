import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Otp } from "@/lib/models/Otp";
import { User } from "@/lib/models/User";
import {
  getPending,
  clearPendingCookie,
  clearAuthCookies,
  createSessionToken,
  setSessionCookie,
} from "@/lib/auth";

const schema = z.object({
  code: z.string().length(6),
});

export async function POST(request: Request) {
  try {
    const pending = await getPending();
    if (!pending || pending.purpose !== "login") {
      return NextResponse.json(
        { error: "Session expired. Please sign in again.", redirect: "/login" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Enter the 6-digit OTP." },
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
        { error: "Incorrect OTP. Please try again." },
        { status: 401 }
      );
    }

    record.consumed = true;
    await record.save();

    const user = await User.findById(pending.userId);
    if (!user) {
      await clearAuthCookies();
      return NextResponse.json(
        { error: "User not found. Please sign in again.", redirect: "/login" },
        { status: 401 }
      );
    }

    const token = await createSessionToken({
      userId: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role,
    });
    await setSessionCookie(token);
    await clearPendingCookie();

    return NextResponse.json({
      ok: true,
      redirect: "/dashboard",
      user: { name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error("OTP verify error:", err);
    return NextResponse.json(
      { error: "Verification failed.", redirect: "/login" },
      { status: 500 }
    );
  }
}
