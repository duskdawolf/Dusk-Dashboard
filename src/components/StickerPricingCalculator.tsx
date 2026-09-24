"use client";

import { useMemo, useState } from "react";

type Laminate = "clear" | "holographic";
type Processing = "standard" | "rush";
type Shipping = "standard" | "rush";

const BASE_PER_25 = 7;
const HOLO_MULTIPLIER = 1.2;
const RUSH_PROCESSING_MULTIPLIER = 1.25;
const SHIPPING = {
  standard: 5,
  rush: 20,
} satisfies Record<Shipping, number>;

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function OptionButton({
  active,
  title,
  detail,
  onClick,
}: {
  active: boolean;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        active
          ? "border-dusk-aqua/50 bg-dusk-aqua/10 shadow-[0_0_30px_rgba(97,232,255,.08)]"
          : "border-dusk-line bg-white/[0.025] hover:border-white/20"
      }`}
    >
      <strong className="block">{title}</strong>
      <span className="mt-1 block text-xs text-slate-500">{detail}</span>
    </button>
  );
}

export function StickerPricingCalculator() {
  const [quantity, setQuantity] = useState(100);
  const [laminate, setLaminate] = useState<Laminate>("clear");
  const [processing, setProcessing] = useState<Processing>("standard");
  const [shipping, setShipping] = useState<Shipping>("standard");

  const pricing = useMemo(() => {
    const base = (quantity / 25) * BASE_PER_25;
    const laminateSurcharge =
      laminate === "holographic" ? base * (HOLO_MULTIPLIER - 1) : 0;
    const printSubtotal = base + laminateSurcharge;
    const processingSurcharge =
      processing === "rush"
        ? printSubtotal * (RUSH_PROCESSING_MULTIPLIER - 1)
        : 0;
    const shippingCost = SHIPPING[shipping];
    const total = printSubtotal + processingSurcharge + shippingCost;

    return {
      base,
      laminateSurcharge,
      printSubtotal,
      processingSurcharge,
      shippingCost,
      total,
      perSticker: total / quantity,
    };
  }, [quantity, laminate, processing, shipping]);

  return (
    <section className="panel mt-12 overflow-hidden">
      <div className="grid gap-8 xl:grid-cols-[1.15fr_.85fr]">
        <div>
          <div className="eyebrow">Live production pricing</div>
          <h2 className="text-4xl font-black tracking-[-.04em]">
            Build Your Sticker Run
          </h2>
          <p className="mt-3 max-w-2xl text-slate-400">
            Drag the run size, choose your finish, and decide exactly how much
            impatience you would like to purchase.
          </p>

          <div className="mt-8 rounded-3xl border border-dusk-aqua/15 bg-[#07101b]/70 p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[.18em] text-slate-500">
                  Quantity
                </div>
                <div className="mt-1 text-5xl font-black text-dusk-aqua">
                  {quantity}
                </div>
              </div>
              <div className="text-right text-sm text-slate-500">
                <div>{money(BASE_PER_25)} per 25</div>
                <div>25–1,000 stickers</div>
              </div>
            </div>

            <input
              aria-label="Sticker quantity"
              className="mt-6 w-full accent-cyan-300"
              type="range"
              min="25"
              max="1000"
              step="25"
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
            />

            <div className="mt-2 flex justify-between text-xs text-slate-600">
              <span>25</span>
              <span>250</span>
              <span>500</span>
              <span>750</span>
              <span>1,000</span>
            </div>
          </div>

          <div className="mt-6">
            <div className="eyebrow">Laminate</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <OptionButton
                active={laminate === "clear"}
                title="Clear Laminate"
                detail="Standard pricing"
                onClick={() => setLaminate("clear")}
              />
              <OptionButton
                active={laminate === "holographic"}
                title="Holographic Laminate"
                detail="+20% print cost"
                onClick={() => setLaminate("holographic")}
              />
            </div>
          </div>

          <div className="mt-6">
            <div className="eyebrow">Processing</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <OptionButton
                active={processing === "standard"}
                title="Standard Processing"
                detail="Included"
                onClick={() => setProcessing("standard")}
              />
              <OptionButton
                active={processing === "rush"}
                title="Rush Processing"
                detail="+25% production subtotal"
                onClick={() => setProcessing("rush")}
              />
            </div>
          </div>

          <div className="mt-6">
            <div className="eyebrow">Shipping</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <OptionButton
                active={shipping === "standard"}
                title="Standard Shipping"
                detail="$5 flat rate"
                onClick={() => setShipping("standard")}
              />
              <OptionButton
                active={shipping === "rush"}
                title="Rush Shipping"
                detail="$20 flat rate"
                onClick={() => setShipping("rush")}
              />
            </div>
          </div>
        </div>

        <aside className="self-start rounded-3xl border border-dusk-pink/20 bg-[radial-gradient(circle_at_top,rgba(255,79,155,.12),transparent_50%),#091321] p-6 xl:sticky xl:top-28">
          <div className="eyebrow">Corporate invoice simulator</div>
          <div className="mt-2 text-6xl font-black tracking-[-.06em] text-white">
            {money(pricing.total)}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {money(pricing.perSticker)} per sticker delivered
          </div>

          <div className="mt-7 space-y-3 border-t border-white/10 pt-5 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">
                {quantity} stickers · clear base
              </span>
              <strong>{money(pricing.base)}</strong>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-slate-400">
                {laminate === "holographic"
                  ? "Holographic laminate +20%"
                  : "Clear laminate"}
              </span>
              <strong>
                {pricing.laminateSurcharge
                  ? `+${money(pricing.laminateSurcharge)}`
                  : "Included"}
              </strong>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-slate-400">
                {processing === "rush"
                  ? "Rush processing +25%"
                  : "Standard processing"}
              </span>
              <strong>
                {pricing.processingSurcharge
                  ? `+${money(pricing.processingSurcharge)}`
                  : "Included"}
              </strong>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-slate-400">
                {shipping === "rush" ? "Rush shipping" : "Standard shipping"}
              </span>
              <strong>{money(pricing.shippingCost)}</strong>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-dusk-gold/20 bg-dusk-gold/5 p-4 text-sm text-slate-300">
            Pricing assumes standard sticker sizing/material usage. Oversized,
            unusually complex, or specialty-material jobs can still require a
            custom quote.
          </div>
        </aside>
      </div>
    </section>
  );
}
