export function NextStopHero(props: { imageUrl?: string | null; eventTitle: string }) {
  if (!props.imageUrl) return null;
  return (
    <section className="mx-auto w-full max-w-md">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#08111d] shadow-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={props.imageUrl} alt={`Dusk's Next Stop — ${props.eventTitle}`} className="aspect-[9/16] w-full object-cover" />
      </div>
    </section>
  );
}
