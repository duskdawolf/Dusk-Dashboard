import { LoginForm } from "@/components/LoginForm";
import {
  supabaseAdminConfigured,
  supabasePublicConfigured,
} from "@/lib/supabase/server";

export const metadata = { title: "Dusk Dashboard Login" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string; unauthorized?: string }>;
}) {
  const params = await searchParams;
  const publicReady = supabasePublicConfigured();
  const adminReady = supabaseAdminConfigured();

  return (
    <main className="mx-auto w-[min(760px,calc(100%-32px))] py-16">
      <div className="eyebrow">Restricted corporate infrastructure</div>
      <h1 className="text-5xl font-black tracking-[-.05em]">Dusk Dashboard</h1>
      <p className="mt-4 text-slate-400">
        Authorized wolves only.
      </p>

      {params.setup || !publicReady || !adminReady ? (
        <div className="panel mt-8">
          <h2 className="text-2xl font-black">Supabase setup required</h2>
          <p className="mt-3 text-slate-400">
            Vercel is connected, but the dashboard needs the Supabase public key,
            server secret key, database schema, and DUSK_ADMIN_EMAILS environment
            variable before writes are enabled.
          </p>
        </div>
      ) : null}

      {params.unauthorized ? (
        <div className="mt-6 rounded-2xl border border-dusk-pink/30 bg-dusk-pink/10 p-4 text-sm">
          You successfully authenticated, but that account is not authorized for
          Dusk Dashboard. Add its email to DUSK_ADMIN_EMAILS in Vercel or promote
          its profile role to editor/admin.
        </div>
      ) : null}

      <div className="mt-8">
        {publicReady ? <LoginForm /> : (
          <div className="panel text-slate-400">
            Supabase browser credentials are not available yet.
          </div>
        )}
      </div>
    </main>
  );
}
