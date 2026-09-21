import { ProductCard } from "@/components/ProductCard";
import { getProducts } from "@/lib/repository";

export const metadata = { title: "Dusk Shop" };

export default async function ShopPage() {
  const products = await getProducts();
  return (
    <main className="mx-auto w-[min(1220px,calc(100%-32px))] py-16">
      <div className="eyebrow">Consumer Products Division</div>
      <h1 className="text-6xl font-black tracking-[-.05em]">The Dusk Shop</h1>
      <p className="mt-5 max-w-3xl text-lg text-slate-400">Finished Dusk stickers, future prints, event packs, and other objects management probably should not have approved.</p>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>
    </main>
  );
}
