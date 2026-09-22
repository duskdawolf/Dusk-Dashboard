import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export const metadata = { title: "Reset Password · Dusk Dashboard" };

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto w-[min(680px,calc(100%-32px))] py-16">
      <div className="eyebrow">Restricted corporate infrastructure</div>
      <h1 className="text-5xl font-black tracking-[-.05em]">
        Set Dashboard Password
      </h1>
      <p className="mt-4 text-slate-400">
        Establish a normal email/password login for Dusk Dashboard.
      </p>
      <div className="mt-8">
        <ResetPasswordForm />
      </div>
    </main>
  );
}
