"use client";

import type { ReactNode } from "react";

export function WorkspaceSheet(props: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm md:items-center md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={props.title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      <div className="max-h-[92vh] w-full overflow-hidden rounded-t-[28px] border border-white/10 bg-[#0b1625] shadow-2xl md:max-w-2xl md:rounded-[28px]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 md:px-6">
          <div>
            <h2 className="text-xl font-black text-white">{props.title}</h2>
            {props.subtitle ? (
              <p className="mt-1 text-sm text-slate-500">{props.subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] text-lg text-slate-300"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="max-h-[calc(92vh-76px)] overflow-y-auto p-5 md:p-6">
          {props.children}
        </div>
      </div>
    </div>
  );
}
