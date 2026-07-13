import { DashboardHome } from "@/components/dashboard/DashboardHome";
import { getSession } from "@/lib/auth";

export default async function DashboardHomePage() {
  const session = await getSession();
  const name = session?.name || "Team Member";

  return <DashboardHome name={name} />;
}
