import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/User";

const LEGACY_EMAIL_MIGRATIONS: Record<string, string> = {
  "shiabaynbiswas@rathi.com": "shibayanbiswas@rathi.com",
};

/** Renames legacy roster emails to their canonical spelling. */
export async function migrateLegacyEmails(): Promise<number> {
  await connectDB();
  let migrated = 0;

  for (const [legacy, canonical] of Object.entries(LEGACY_EMAIL_MIGRATIONS)) {
    const legacyUser = await User.findOne({ email: legacy });
    if (!legacyUser) continue;

    const canonicalUser = await User.findOne({ email: canonical });
    if (canonicalUser) {
      await User.deleteOne({ _id: legacyUser._id });
    } else {
      legacyUser.email = canonical;
      await legacyUser.save();
    }
    migrated += 1;
  }

  return migrated;
}
