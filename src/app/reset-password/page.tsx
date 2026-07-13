import { redirect } from "next/navigation";

/** Legacy route — password reset is now OTP-based at /change-password. */
export default function ResetPasswordRedirect() {
  redirect("/change-password");
}
