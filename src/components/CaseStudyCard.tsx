import { DeploymentImage } from "@/components/convention-directory/DeploymentImage";
import type { CaseStudy } from "@/types";

export function CaseStudyCard({ item }: { item: CaseStudy }) {
  return (
    <article className="overflow-hidden rounded-3xl border border-dusk-line bg-dusk-panel shadow-dusk">
      <div className="relative aspect-video">
        <DeploymentImage
          images={item.imageCandidates ?? [item.image]}
          alt={item.title}
        />
      </div>
      <div className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-2xl font-black">{item.title}</h3>
          <span className="tag">{item.status}</span>
        </div>
        <div className="mt-4 space-y-2 text-sm text-slate-300">
          <p>
            <strong>Challenge:</strong> {item.challenge}
          </p>
          <p>
            <strong>Solution:</strong> {item.solution}
          </p>
          <p>
            <strong>Outcome:</strong> {item.outcome}
          </p>
        </div>
      </div>
    </article>
  );
}
