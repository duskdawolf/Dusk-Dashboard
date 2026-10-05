export function NextStopHero({
  imageUrl,
  eventTitle,
}: {
  imageUrl?: string | null;
  eventTitle: string;
}) {
  if (!imageUrl) return null;
  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#07101b]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={`Dusk's Next Stop — ${eventTitle}`}
        className="aspect-[9/16] w-full object-cover"
      />
    </div>
  );
}
