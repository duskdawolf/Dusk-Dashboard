"use client";

import { useState } from "react";
import type { EventItem } from "@/types";

const silhouette = "M72,173 L86,160 L94,132 L110,120 L132,112 L145,95 L172,84 L203,82 L224,87 L249,91 L278,98 L308,96 L336,94 L355,104 L384,100 L402,93 L432,91 L458,97 L478,109 L500,108 L518,101 L544,102 L562,113 L586,126 L610,125 L628,117 L646,118 L664,129 L687,132 L710,128 L734,138 L762,140 L786,148 L816,153 L835,167 L847,188 L835,202 L824,210 L820,224 L831,243 L838,260 L852,274 L866,292 L879,327 L892,355 L898,376 L888,394 L870,399 L851,392 L842,374 L837,353 L830,338 L822,329 L808,334 L792,350 L780,354 L768,343 L759,327 L746,310 L734,297 L724,282 L707,277 L693,280 L680,293 L666,303 L653,305 L642,294 L637,278 L628,270 L613,271 L597,280 L584,292 L567,300 L545,305 L531,310 L520,325 L512,341 L501,348 L483,343 L472,328 L461,313 L441,309 L419,314 L401,321 L386,331 L372,331 L360,323 L348,307 L334,301 L312,298 L292,303 L272,304 L249,299 L224,294 L209,286 L188,284 L170,285 L155,273 L146,258 L131,251 L120,236 L105,228 L95,208 L83,195 Z";

export function PawprintMap({ events }: { events: EventItem[] }) {
  const [filter, setFilter] = useState<"all" | EventItem["quarter"]>("all");
  const visible = events.filter((event) => filter === "all" || event.quarter === filter).filter((event) => event.mapX && event.mapY);

  return (
    <div className="panel">
      <div className="mb-5 flex flex-wrap gap-2">
        {(["all","q1","q2","q3","q4"] as const).map((q) => (
          <button key={q} onClick={() => setFilter(q)} className={`rounded-full border px-3 py-2 text-xs font-black ${filter === q ? "border-dusk-pink/40 bg-dusk-pink/15" : "border-dusk-line bg-white/5"}`}>
            {q === "all" ? "All 2026" : q.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="relative min-h-[430px] overflow-hidden rounded-2xl border border-white/5 bg-[#0a1120]">
        <svg viewBox="0 0 1000 600" className="absolute inset-0 h-full w-full">
          <path d={silhouette} fill="#12223a" stroke="#2d4a6b" strokeWidth="6" strokeLinejoin="round" />
          <path d="M763,193 C760,190 742,198 730,214 C716,233 722,257 736,274 C719,281 700,295 684,311 C670,322 651,334 635,341 C616,346 612,364 629,390 C648,420 682,474 690,511 C700,473 709,433 728,392 C744,356 762,326 780,295 C741,238 694,176 615,168" fill="none" stroke="#ff4f9b" strokeWidth="8" strokeDasharray="14 12" strokeLinecap="round" className="animate-[dash_14s_linear_infinite]" />
        </svg>
        {visible.map((event, index) => (
          <div key={event.id}>
            <div className="absolute -translate-x-1/2 -translate-y-1/2 animate-pulse text-2xl" style={{ left: `${event.mapX}%`, top: `${event.mapY}%` }}>🐾</div>
            <div className="absolute -translate-x-1/2 rounded-xl border border-[#314b67] bg-[#050910]/90 px-2 py-1 text-[11px] font-black" style={{ left: `${event.mapX}%`, top: `calc(${event.mapY}% + ${20 + (index % 2) * 10}px)` }}>{event.title}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
