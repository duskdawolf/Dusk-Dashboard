import Link from "next/link";

export function DeploymentsNav() {
  return (
    <details className="group relative">
      <summary className="cursor-pointer list-none text-slate-400 transition hover:text-white [&::-webkit-details-marker]:hidden">
        Deployments <span aria-hidden="true">▾</span>
      </summary>

      <div className="absolute left-1/2 top-[calc(100%+12px)] z-[80] w-60 -translate-x-1/2 overflow-hidden rounded-2xl border border-white/10 bg-[#0b1524]/95 p-2 shadow-2xl backdrop-blur-xl">
        <Link
          href="/deployments/future"
          className="block rounded-xl px-3 py-3 transition hover:bg-white/[0.06]"
        >
          <span className="block text-sm font-black text-white">
            Future
          </span>
          <span className="mt-0.5 block text-[11px] text-slate-500">
            Tactical Deployment Plans
          </span>
        </Link>

        <Link
          href="/deployments/past"
          className="block rounded-xl px-3 py-3 transition hover:bg-white/[0.06]"
        >
          <span className="block text-sm font-black text-white">
            Past
          </span>
          <span className="mt-0.5 block text-[11px] text-slate-500">
            Case Studies in Chaos
          </span>
        </Link>
      </div>
    </details>
  );
}
