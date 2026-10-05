import type { ReactNode } from "react";

export function DisclosureCard(props: {
  title: string;
  summary?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: string;
  actions?: ReactNode;
}) {
  return (
    <details
      open={props.defaultOpen}
      className="group overflow-hidden rounded-3xl border border-white/10 bg-[#0c1727] shadow-[0_18px_45px_rgba(0,0,0,.12)]"
    >
      <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 md:px-6 md:py-5 [&::-webkit-details-marker]:hidden">
        <div className="grid min-w-0 flex-1 gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-black text-white md:text-lg">
              {props.title}
            </h3>
            {props.badge ? (
              <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-300">
                {props.badge}
              </span>
            ) : null}
          </div>
          {props.summary ? (
            <p className="truncate text-xs text-slate-500 md:text-sm">
              {props.summary}
            </p>
          ) : null}
        </div>

        {props.actions ? (
          <div
            className="flex shrink-0 items-center gap-2"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            {props.actions}
          </div>
        ) : null}

        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.05] text-slate-400 transition group-open:rotate-180">
          ⌄
        </div>
      </summary>

      <div className="border-t border-white/8 px-5 py-5 md:px-6">
        {props.children}
      </div>
    </details>
  );
}
