import { AccountSecurity } from "@/components/AccountSecurity";
import { requireDashboardUser } from "@/lib/auth";

export const metadata = { title: "Account Security · Dusk Dashboard" };
export const dynamic = "force-dynamic";

export default async function AccountSecurityPage() {
  const user = await requireDashboardUser();

  return <AccountSecurity currentEmail={user.email} />;
}
