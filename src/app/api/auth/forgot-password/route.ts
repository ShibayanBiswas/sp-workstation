import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/User";
import { Otp } from "@/lib/models/Otp";
import {
  generateOtp,
  createPendingToken,
  setPendingCookie,
} from "@/lib/auth";
import { resolveLoginEmail } from "@/lib/email-aliases";
import { TEAM_MEMBERS } from "@/data/team";

const schema = z.object({
  email: z.string().email(),
});

const allowedEmails = new Set(TEAM_MEMBERS.map((member) => member.email));

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid email ID." },
        { status: 400 }
      );
    }

    const email = resolveLoginEmail(parsed.data.email);
    if (!allowedEmails.has(email)) {
      return NextResponse.json(
        { error: "Invalid email ID." },
        { status: 401 }
      );
    }

    await connectDB();
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.findOne({
        email: parsed.data.email.toLowerCase().trim(),
      });
    }

    const generic = {
      ok: true,
      message:
        "If this email is registered, a verification code has been generated.",
    };

    if (!user) {
      return NextResponse.json(generic);
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
      ...generic,
      email: user.email,
      otp: code,
      redirect: "/change-password",
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    return NextResponse.json(
      { error: "Unable to process request." },
      { status: 500 }
    );
  }
}
