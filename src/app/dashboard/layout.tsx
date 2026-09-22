import { DashboardNav } from "@/components/DashboardNav";
import { requireDashboardUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireDashboardUser();

  return (
    <main className="mx-auto w-[min(1220px,calc(100%-32px))] py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="eyebrow">Dusk Industries command center</div>
          <h1 className="text-4xl font-black tracking-[-.05em]">
            Dusk Dashboard
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Signed in as {user.email}.
          </p>
        </div>

        <form action="/auth/logout" method="post">
          <button className="button-secondary" type="submit">
            Sign out
          </button>
        </form>
      </div>

      <DashboardNav />
      {children}
    </main>
  );
}
