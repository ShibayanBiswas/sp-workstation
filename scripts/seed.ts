import { seedTeamMembers } from "../src/lib/seed";

async function main() {
  const result = await seedTeamMembers();
  console.log("Seed complete:", result);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
