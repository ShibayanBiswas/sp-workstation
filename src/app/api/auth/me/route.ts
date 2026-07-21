import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    user: {
      name: session.name,
      email: session.email,
      role: session.role,
      userId: session.userId,
    },
    /** Unix seconds — client schedules auto sign-out at this time. */
    expiresAt: session.exp ?? null,
  });
}
