import Link from "next/link";

export function DeploymentFilterLink({
  value,
  mode,
  label,
}: {
  value: string;
  mode: "future" | "past";
  label?: string;
}) {
  const visible = label ?? value;

  return (
    <Link
      href={`/deployments/${mode}?tag=${encodeURIComponent(value)}`}
      title={`Filter ${mode} deployments by ${visible}`}
      className="tag !mt-0 transition hover:border-dusk-aqua/35 hover:text-dusk-aqua"
    >
      {visible}
    </Link>
  );
}
