import { redirect } from "next/navigation";
import { hasAdminPassword } from "@/lib/auth";
import SetupAccountForm from "./SetupAccountForm";

export const dynamic = "force-dynamic";

export default async function AdminSetupPage() {
  // Setup is only for creating the first account -- once one exists, send
  // anyone who lands here to log in instead.
  if (await hasAdminPassword()) {
    redirect("/admin/login");
  }

  return <SetupAccountForm />;
}
