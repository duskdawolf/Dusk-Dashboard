import { APP_VERSION } from "@/lib/app-version";

export function AppVersionFooter() {
  return (
    <footer className="border-t border-white/10 px-5 py-7 text-xs text-slate-500">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3">
        <span>Copyright 2026 Dusk Induskries.</span>
        <span className="font-black tracking-wide text-slate-400">
          {APP_VERSION}
        </span>
      </div>
    </footer>
  );
}
