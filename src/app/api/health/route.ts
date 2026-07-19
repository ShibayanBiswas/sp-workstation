import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/User";
import { jsonDynamic } from "@/lib/json-dynamic";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Lightweight readiness probe for Vercel / ops — no secrets returned. */
export async function GET() {
  const hasUri = Boolean(
    process.env.MONGODB_URI && process.env.MONGODB_URI !== "memory"
  );
  const hasJwt = Boolean(process.env.JWT_SECRET);
  const hasSeedMap = Boolean(process.env.SEED_DEFAULT_PASSWORD_MAP);

  try {
    await connectDB();
    const users = await User.countDocuments();
    return jsonDynamic({
      ok: true,
      mongo: "connected",
      users,
      env: {
        MONGODB_URI: hasUri,
        JWT_SECRET: hasJwt,
        SEED_DEFAULT_PASSWORD_MAP: hasSeedMap,
        FORCE_RESET_PASSWORDS: process.env.FORCE_RESET_PASSWORDS === "true",
      },
      asOf: new Date().toISOString(),
    });
  } catch (err) {
    return jsonDynamic(
      {
        ok: false,
        mongo: "disconnected",
        error: err instanceof Error ? err.message : "DB connect failed",
        env: {
          MONGODB_URI: hasUri,
          JWT_SECRET: hasJwt,
          SEED_DEFAULT_PASSWORD_MAP: hasSeedMap,
          FORCE_RESET_PASSWORDS: process.env.FORCE_RESET_PASSWORDS === "true",
        },
        asOf: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
