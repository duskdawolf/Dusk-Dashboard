import Image from "next/image";
import { QuoteForm } from "@/components/QuoteForm";
import { StickerPricingCalculator } from "@/components/StickerPricingCalculator";

export const metadata = { title: "Dusk Sticker Factory" };

export default function StickerFactoryPage() {
  return (
    <main className="mx-auto w-[min(1220px,calc(100%-32px))] py-16">
      <div className="grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
        <div>
          <div className="eyebrow">Commercial Services Division</div>
          <h1 className="text-6xl font-black tracking-[-.05em]">
            Dusk Sticker Factory
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-400">
            Custom furry sticker printing dressed up like an enterprise
            print-services division because apparently that’s what we’re doing now.
          </p>
        </div>
        <div className="panel">
          <Image
            src="/assets/sticker-megaplex.jpg"
            alt="Megaplex Dusk sticker"
            width={1200}
            height={1200}
            className="rounded-2xl"
          />
        </div>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        <div className="card">
          <div className="eyebrow">Base Rate</div>
          <h3 className="text-xl font-black">$7 / 25 stickers</h3>
          <p className="mt-2 text-slate-400">
            Clear laminate standard production.
          </p>
        </div>
        <div className="card">
          <div className="eyebrow">Premium</div>
          <h3 className="text-xl font-black">Holographic +20%</h3>
          <p className="mt-2 text-slate-400">
            Convention-grade sparkle for louder drops.
          </p>
        </div>
        <div className="card">
          <div className="eyebrow">Impatient Wolf Department</div>
          <h3 className="text-xl font-black">Rush Processing +25%</h3>
          <p className="mt-2 text-slate-400">
            Separate from rush shipping, because chaos has layers.
          </p>
        </div>
      </div>

      <StickerPricingCalculator />

      <section className="panel mt-12">
        <div className="eyebrow">Custom / specialty intake</div>
        <h2 className="mb-6 text-3xl font-black">
          Need something outside the calculator?
        </h2>
        <QuoteForm />
      </section>
    </main>
  );
}
