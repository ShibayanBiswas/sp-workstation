import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User, type UserDocument } from "@/lib/models/User";

const COOKIE_NAME = "sp_session";
const PENDING_COOKIE = "sp_pending";

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  userId: string;
  email: string;
  name: string;
  role: string;
};

export type PendingPurpose = "login" | "password_reset";

export type PendingPayload = {
  userId: string;
  email: string;
  name: string;
  purpose: PendingPurpose;
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
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
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

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function setPendingCookie(token: string) {
  const jar = await cookies();
  jar.set(PENDING_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
}

export async function clearAuthCookies() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
  jar.delete(PENDING_COOKIE);
}

export async function clearPendingCookie() {
  const jar = await cookies();
  jar.delete(PENDING_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken<SessionPayload>(token);
}

export async function getPending(): Promise<PendingPayload | null> {
  const jar = await cookies();
  const token = jar.get(PENDING_COOKIE)?.value;
  if (!token) return null;
  return verifyToken<PendingPayload>(token);
}

export async function getCurrentUser(): Promise<UserDocument | null> {
  const session = await getSession();
  if (!session) return null;
  await connectDB();
  const user = await User.findById(session.userId).lean();
  return user as UserDocument | null;
}

export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
