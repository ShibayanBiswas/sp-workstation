import { existsSync, readFileSync } from "fs";
import path from "path";
import { seedTeamMembers } from "../src/lib/seed";

/** Load gitignored .env.local for CLI seed (Next.js does this automatically at runtime). */
function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();
  const uri = process.env.MONGODB_URI?.trim() || "(unset)";
  const dbHint = uri.includes("/sp-workstation")
    ? "database=sp-workstation (isolated from other cluster DBs)"
    : uri === "memory"
      ? "in-memory only"
      : "check URI includes /sp-workstation";
  console.log(`[seed] target: ${dbHint}`);
  if (!uri.includes("mongodb") && uri !== "memory") {
    console.warn("[seed] MONGODB_URI looks empty — refusing to continue");
    process.exit(1);
  }
  const result = await seedTeamMembers();
  console.log("Seed complete:", result);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
