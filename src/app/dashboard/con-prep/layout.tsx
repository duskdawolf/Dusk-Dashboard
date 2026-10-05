import type { ReactNode } from "react";
import { Alpha8ConventionWorkspace } from "@/components/alpha8/Alpha8ConventionWorkspace";

export default function Alpha8ConPrepLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-6">
      <Alpha8ConventionWorkspace />

      <details id="alpha8-legacy" className="group overflow-hidden rounded-3xl border border-white/10 bg-[#0a1422]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-black text-slate-300 [&::-webkit-details-marker]:hidden">
          <span>Advanced / Legacy workspace</span>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.05] text-slate-500 transition group-open:rotate-180">⌄</span>
        </summary>
        <div className="border-t border-white/8 p-3 md:p-4">
          {children}
        </div>
      </details>
    </div>
  );
}
