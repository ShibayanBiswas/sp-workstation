import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { getPending, getSession } from "@/lib/auth";

export default async function ChangePasswordPage() {
  const session = await getSession();
  const pending = await getPending();

  if (!session && (!pending || pending.purpose !== "password_reset")) {
    redirect("/login");
  }

  return <ChangePasswordForm fromDashboard={Boolean(session)} />;
}
