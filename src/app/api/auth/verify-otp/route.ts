import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Otp } from "@/lib/models/Otp";
import { User } from "@/lib/models/User";
import {
  getPending,
  createSessionToken,
  applySessionCookie,
  clearCookiesOnResponse,
  newSessionId,
  normalizeOtpCode,
  PENDING_COOKIE,
  invalidateSessionCache,
} from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const schema = z.object({
  code: z.string().min(1),
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
    const code = normalizeOtpCode(parsed.success ? parsed.data.code : body?.code);
    if (code.length !== 6) {
      return NextResponse.json(
        { error: "Enter the 6-digit OTP." },
        { status: 400 }
      );
    }

    if (!mongoose.isValidObjectId(pending.otpId)) {
      return NextResponse.json(
        { error: "Session expired. Please sign in again.", redirect: "/login" },
        { status: 401 }
      );
    }

    await connectDB();
    const record = await Otp.findOne({
      _id: pending.otpId,
      userId: pending.userId,
      consumed: false,
      expiresAt: { $gt: new Date() },
    });

    if (!record || record.code !== code) {
      return NextResponse.json(
        { error: "Incorrect OTP. Please try again." },
        { status: 401 }
      );
    }

    record.consumed = true;
    await record.save();

    const user = await User.findById(pending.userId);
    if (!user) {
      const res = NextResponse.json(
        { error: "User not found. Please sign in again.", redirect: "/login" },
        { status: 401 }
      );
      clearCookiesOnResponse(res);
      return res;
    }

    // Single device: rotate session id — every other device is logged out.
    const sid = newSessionId();
    user.activeSessionId = sid;
    await user.save();
    invalidateSessionCache(String(user._id));

    const token = await createSessionToken({
      userId: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role,
      sid,
    });

    const res = NextResponse.json({
      ok: true,
      redirect: "/dashboard",
      user: { name: user.name, email: user.email, role: user.role },
    });
    applySessionCookie(res, token);
    // Drop pending OTP cookie now that login is complete.
    res.cookies.set(PENDING_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure:
        process.env.NODE_ENV === "production" || process.env.VERCEL === "1",
      maxAge: 0,
    });
    return res;
  } catch (err) {
    console.error("OTP verify error:", err);
    return NextResponse.json(
      { error: "Verification failed.", redirect: "/login" },
      { status: 500 }
    );
  }
}
