import Image from "next/image";
import { QuoteForm } from "@/components/QuoteForm";

export const metadata = { title: "Dusk Sticker Factory" };

export default function StickerFactoryPage() {
  return (
    <main className="mx-auto w-[min(1220px,calc(100%-32px))] py-16">
      <div className="grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
        <div>
          <div className="eyebrow">Commercial Services Division</div>
          <h1 className="text-6xl font-black tracking-[-.05em]">Dusk Sticker Factory</h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-400">Custom furry sticker printing dressed up like an enterprise print-services division because apparently that’s what we’re doing now.</p>
        </div>
        <div className="panel"><Image src="/assets/sticker-megaplex.jpg" alt="Megaplex Dusk sticker" width={1200} height={1200} className="rounded-2xl" /></div>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        <div className="card"><div className="eyebrow">Core</div><h3 className="text-xl font-black">Kiss-cut / die-cut</h3><p className="mt-2 text-slate-400">Everyday merch, artist runs, and event use.</p></div>
        <div className="card"><div className="eyebrow">Premium</div><h3 className="text-xl font-black">Holographic</h3><p className="mt-2 text-slate-400">Convention-grade sparkle for louder drops.</p></div>
        <div className="card"><div className="eyebrow">Flexible</div><h3 className="text-xl font-black">Small-batch runs</h3><p className="mt-2 text-slate-400">Perfect for tests, meetups, artists, and limited releases.</p></div>
      </div>

      <section className="panel mt-12">
        <div className="eyebrow">Quote intake</div>
        <h2 className="mb-6 text-3xl font-black">Tell the factory what you need</h2>
        <QuoteForm />
      </section>
    </main>
  );
}
