import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/User";
import {
  clearCookiesOnResponse,
  COOKIE_NAME,
  invalidateSessionCache,
  verifyToken,
  type SessionPayload,
} from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });

  try {
    // Best-effort: revoke the account's active device session in Mongo.
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (token) {
      const session = await verifyToken<SessionPayload>(token);
      if (session?.userId && session.sid) {
        await connectDB();
        await User.updateOne(
          { _id: session.userId, activeSessionId: session.sid },
          { $set: { activeSessionId: null } }
        );
        invalidateSessionCache(session.userId);
      }
    }
  } catch (err) {
    console.error("Logout revoke error:", err);
  }

  clearCookiesOnResponse(res);
  return res;
}
