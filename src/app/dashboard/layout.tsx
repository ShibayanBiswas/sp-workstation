import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { getSession } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <DashboardShell userName={session.name} userEmail={session.email}>
      {children}
    </DashboardShell>
  );
}
