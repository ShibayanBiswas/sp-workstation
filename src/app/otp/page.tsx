import { redirect } from "next/navigation";
import { OtpForm } from "@/components/auth/OtpForm";
import { getPending, getSession } from "@/lib/auth";

export default async function OtpPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");
  const pending = await getPending();
  if (!pending) redirect("/login");
  if (pending.purpose !== "login") redirect("/change-password");
  return <OtpForm />;
}
