"use client";

import { useMemo, useState } from "react";
import { events, products, socialLinks } from "@/data/seed";

type Tab = "overview" | "events" | "socials" | "products" | "architecture";

export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [eventJson, setEventJson] = useState(JSON.stringify(events, null, 2));
  const [productJson, setProductJson] = useState(JSON.stringify(products, null, 2));

  const tabs: Tab[] = ["overview", "events", "socials", "products", "architecture"];

  const architecture = useMemo(() => [
    "PostgreSQL / Supabase for structured content",
    "Supabase Storage for photos, clips, product art, and uploads",
    "Supabase Auth for Dusk-only dashboard access",
    "Next.js Route Handlers for quotes, admin mutations, and Stripe webhooks",
    "Stripe for checkout when the shop is ready",
  ], []);

  return (
    <main className="mx-auto w-[min(1220px,calc(100%-32px))] py-12">
      <div className="eyebrow">Backend prototype</div>
      <h1 className="text-5xl font-black tracking-[-.05em]">Dusk Dashboard</h1>
      <p className="mt-4 max-w-3xl text-slate-400">This is the front-end shell for the future CMS. The repository and SQL schema in this project are already designed to replace seed data with Supabase.</p>

      <div className="mt-8 flex flex-wrap gap-2">
        {tabs.map((item) => <button key={item} onClick={() => setTab(item)} className={`rounded-xl border px-4 py-2 text-sm font-black capitalize ${tab === item ? "border-dusk-aqua/40 bg-dusk-aqua/10" : "border-dusk-line bg-white/5"}`}>{item}</button>)}
      </div>

      <section className="panel mt-6">
        {tab === "overview" && <div className="grid gap-4 md:grid-cols-3">
          <div className="card"><strong>Events</strong><div className="mt-2 text-5xl font-black text-dusk-aqua">{events.length}</div></div>
          <div className="card"><strong>Products</strong><div className="mt-2 text-5xl font-black text-dusk-pink">{products.length}</div></div>
          <div className="card"><strong>Socials</strong><div className="mt-2 text-5xl font-black text-dusk-gold">{socialLinks.length}</div></div>
        </div>}
        {tab === "events" && <textarea value={eventJson} onChange={(e) => setEventJson(e.target.value)} className="form-input min-h-[460px] font-mono text-xs" />}
        {tab === "products" && <textarea value={productJson} onChange={(e) => setProductJson(e.target.value)} className="form-input min-h-[460px] font-mono text-xs" />}
        {tab === "socials" && <div className="space-y-3">{socialLinks.map((item) => <div key={item.id} className="card flex flex-wrap justify-between gap-3"><strong>{item.name}</strong><span className="text-slate-400">{item.handle}</span><span className="text-dusk-aqua">{item.url}</span></div>)}</div>}
        {tab === "architecture" && <div className="space-y-3">{architecture.map((item) => <div key={item} className="card">{item}</div>)}</div>}
      </section>
    </main>
  );
}
