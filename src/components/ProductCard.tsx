import Image from "next/image";
import type { Product } from "@/types";

export function ProductCard({ product }: { product: Product }) {
  return (
    <article className="card">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-white/5">
        <Image src={product.image} alt={product.name} fill className="object-contain p-2" />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <h3 className="font-black">{product.name}</h3>
        <span className="text-xs font-black text-dusk-aqua">{product.priceLabel}</span>
      </div>
      <p className="mt-2 text-sm text-slate-400">{product.description}</p>
    </article>
  );
}
