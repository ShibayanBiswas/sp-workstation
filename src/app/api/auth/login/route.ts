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
import { seedTeamMembers } from "@/lib/seed";
import { resolveLoginEmail } from "@/lib/email-aliases";
import { migrateLegacyEmails } from "@/lib/migrate-emails";
import { TEAM_MEMBERS } from "@/data/team";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const allowedEmails = new Set(
  TEAM_MEMBERS.map((member) => member.email.toLowerCase())
);

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

    const inputEmail = parsed.data.email.toLowerCase().trim();
    const canonical = resolveLoginEmail(inputEmail);
    if (!allowedEmails.has(canonical)) {
      return NextResponse.json(
        { error: "Invalid email ID." },
        { status: 401 }
      );
    }

    await connectDB();
    await migrateLegacyEmails();

    const count = await User.countDocuments();
    if (count === 0) {
      await seedTeamMembers();
    }

    let user = await User.findOne({
      email: { $in: [canonical, inputEmail] },
    });

    // If roster email is valid but missing in DB (common on first Vercel deploy),
    // seed missing team members once, then retry the lookup.
    if (!user) {
      await seedTeamMembers();
      user = await User.findOne({
        email: { $in: [canonical, inputEmail] },
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email ID." },
        { status: 401 }
      );
    }

    const ok = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { error: "Wrong password." },
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

    const pending = await createPendingToken({
      userId: String(user._id),
      email: user.email,
      name: user.name,
      purpose: "login",
    });
    await setPendingCookie(pending);

    return NextResponse.json({
      ok: true,
      message: "Enter the verification code shown on the next screen.",
      email: user.email,
      otp: code,
    });
  } catch (err) {
    console.error("Login error:", err);
    const message =
      err instanceof Error ? err.message : "Unable to sign in right now.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
