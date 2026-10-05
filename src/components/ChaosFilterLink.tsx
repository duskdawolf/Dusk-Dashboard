import Link from "next/link";

export function ChaosFilterLink({
  value,
  label,
}: {
  value: string;
  label?: string;
}) {
  const visible = label ?? value;

  return (
    <Link
      href={`/chaos?tag=${encodeURIComponent(value)}`}
      title={`Filter Case Studies in Chaos by ${visible}`}
      className="tag !mt-0 transition hover:border-dusk-aqua/35 hover:text-dusk-aqua"
    >
      {visible}
    </Link>
  );
}
