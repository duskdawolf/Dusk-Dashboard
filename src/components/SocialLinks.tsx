import type { SocialLink } from "@/types";

export function SocialLinks({ links }: { links: SocialLink[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {links.map((link) => (
        <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="card transition hover:-translate-y-1 hover:border-dusk-aqua/30">
          <strong>{link.name}</strong>
          <span className="mt-1 block text-sm text-slate-400">{link.handle}</span>
        </a>
      ))}
    </div>
  );
}
