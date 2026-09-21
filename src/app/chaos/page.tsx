import { CaseStudyCard } from "@/components/CaseStudyCard";
import { getCaseStudies } from "@/lib/repository";

export const metadata = { title: "Case Studies in Chaos" };

export default async function ChaosPage() {
  const studies = await getCaseStudies();
  return (
    <main className="mx-auto w-[min(1220px,calc(100%-32px))] py-16">
      <div className="eyebrow">Performance archive</div>
      <h1 className="text-6xl font-black tracking-[-.05em]">Case Studies in Chaos.</h1>
      <p className="mt-5 max-w-3xl text-lg text-slate-400">Enterprise-grade documentation of successful wolf deployments, community engagement, and other operational nonsense.</p>
      <div className="mt-10 grid gap-5 lg:grid-cols-2">{studies.map((item) => <CaseStudyCard key={item.id} item={item} />)}</div>
    </main>
  );
}
