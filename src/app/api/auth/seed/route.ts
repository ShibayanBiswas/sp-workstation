import { NextResponse } from "next/server";
import { seedTeamMembers } from "@/lib/seed";

export async function POST(request: Request) {
  const secret = request.headers.get("x-seed-secret");
  const expected = process.env.JWT_SECRET || "dev";
  if (secret !== expected && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await seedTeamMembers();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Seed error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Seed failed",
      },
      { status: 500 }
    );
  }
}
