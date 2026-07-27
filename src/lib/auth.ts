import { randomUUID } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/User";

export const COOKIE_NAME = "sp_session";
export const PENDING_COOKIE = "sp_pending";

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

/** Secure cookies on Vercel / production HTTPS. */
function cookieSecure(): boolean {
  return (
    process.env.NODE_ENV === "production" || process.env.VERCEL === "1"
  );
}

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
};

export type SessionPayload = {
  userId: string;
  email: string;
  name: string;
  role: string;
  /** Rotates on every successful sign-in — enforces one device per account. */
  sid: string;
  /** Unix seconds JWT expiry — set when reading a verified token. */
  exp?: number;
};

/** Session lifetime for cookies and JWT (must stay in sync). */
export const SESSION_MAX_AGE_SEC = 60 * 60 * 12;

export type PendingPurpose = "login" | "password_reset";

export type PendingPayload = {
  userId: string;
  email: string;
  name: string;
  purpose: PendingPurpose;
  /** Exact OTP document to verify — avoids wrong-row / cast flakiness. */
  otpId: string;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(
  payload: SessionPayload
): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    email: payload.email,
    name: payload.name,
    role: payload.role,
    sid: payload.sid,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SEC}s`)
    .sign(getSecret());
}

export async function createPendingToken(
  payload: PendingPayload
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(getSecret());
}

export async function verifyToken<T>(token: string): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as T;
  } catch {
    return null;
  }
}

export function applySessionCookie(res: NextResponse, token: string) {
  res.cookies.set(COOKIE_NAME, token, {
    ...cookieBase,
    secure: cookieSecure(),
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

export function applyPendingCookie(res: NextResponse, token: string) {
  res.cookies.set(PENDING_COOKIE, token, {
    ...cookieBase,
    secure: cookieSecure(),
    maxAge: 60 * 10,
  });
}

export function clearCookiesOnResponse(res: NextResponse) {
  res.cookies.set(COOKIE_NAME, "", {
    ...cookieBase,
    secure: cookieSecure(),
    maxAge: 0,
  });
  res.cookies.set(PENDING_COOKIE, "", {
    ...cookieBase,
    secure: cookieSecure(),
    maxAge: 0,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const session = payload as unknown as SessionPayload;
    if (!session.userId || !session.email || !session.sid) return null;

    await connectDB();
    const user = await User.findById(session.userId)
      .select("activeSessionId email name role")
      .lean();
    if (!user) return null;

    // One active device: JWT sid must match the account's current session.
    if (!user.activeSessionId || user.activeSessionId !== session.sid) {
      return null;
    }

    return {
      userId: session.userId,
      email: session.email,
      name: session.name,
      role: session.role,
      sid: session.sid,
      exp: typeof payload.exp === "number" ? payload.exp : undefined,
    };
  } catch {
    return null;
  }
}

export async function getPending(): Promise<PendingPayload | null> {
  const jar = await cookies();
  const token = jar.get(PENDING_COOKIE)?.value;
  if (!token) return null;
  const pending = await verifyToken<PendingPayload>(token);
  if (!pending?.userId || !pending.otpId || !pending.purpose) return null;
  return pending;
}

export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function newSessionId(): string {
  return randomUUID();
}

export function normalizeOtpCode(raw: unknown): string {
  return String(raw ?? "")
    .replace(/\D/g, "")
    .slice(0, 6);
}
