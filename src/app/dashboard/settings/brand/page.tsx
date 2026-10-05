import { Alpha71BrandAssetsPanel } from "@/components/alpha71/Alpha71BrandAssetsPanel";

export default function BrandMediaSettingsPage() {
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-5 p-4 md:p-6">
      <header className="rounded-3xl border border-white/10 bg-[#0c1727] p-5 md:p-7">
        <div className="text-[11px] font-black uppercase tracking-[.22em] text-cyan-300">Settings</div>
        <h1 className="mt-2 text-3xl font-black text-white">Brand & Media</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Global Dusk artwork, logo, and Next Stop composition defaults live here instead of inside a single convention workspace.
        </p>
      </header>
      <Alpha71BrandAssetsPanel />
    </main>
  );
}
