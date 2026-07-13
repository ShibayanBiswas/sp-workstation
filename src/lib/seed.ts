import { readFileSync, existsSync } from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/User";
import { TEAM_MEMBERS } from "@/data/team";
import { migrateLegacyEmails } from "@/lib/migrate-emails";

function loadPasswordMap(): Record<string, string> {
  if (process.env.SEED_DEFAULT_PASSWORD_MAP) {
    try {
      return JSON.parse(process.env.SEED_DEFAULT_PASSWORD_MAP) as Record<
        string,
        string
      >;
    } catch {
      console.warn("Invalid SEED_DEFAULT_PASSWORD_MAP JSON");
    }
  }

  const localPath = path.join(
    process.cwd(),
    "scripts",
    "seed-passwords.local.json"
  );
  if (existsSync(localPath)) {
    return JSON.parse(readFileSync(localPath, "utf8")) as Record<
      string,
      string
    >;
  }

  return {};
}

export async function seedTeamMembers(): Promise<{
  created: number;
  updated: number;
  skipped: number;
  total: number;
}> {
  await connectDB();
  await migrateLegacyEmails();
  const passwords = loadPasswordMap();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const member of TEAM_MEMBERS) {
    const email = member.email.toLowerCase();
    const existing = await User.findOne({ email });
    const password =
      member.password || passwords[email] || passwords[member.email];

    if (existing) {
      existing.name = member.name;
      existing.role = member.role;
      if (process.env.FORCE_RESET_PASSWORDS === "true" && password) {
        existing.passwordHash = await bcrypt.hash(password, 12);
      }
      await existing.save();
      updated += 1;
      continue;
    }

    if (!password) {
      console.warn(`No default password for ${email} — skipping create`);
      skipped += 1;
      continue;
    }

    await User.create({
      name: member.name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: member.role,
      team: "Structured Products",
    });
    created += 1;
  }

  return { created, updated, skipped, total: TEAM_MEMBERS.length };
}
