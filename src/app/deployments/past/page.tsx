import { DeploymentArchivePage } from "@/components/DeploymentArchivePage";

export const metadata = { title: "Case Studies in Chaos" };
export const dynamic = "force-dynamic";

export default async function PastDeploymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.tag) ? params.tag[0] : params.tag;

  return (
    <DeploymentArchivePage
      mode="past"
      tag={raw?.trim() ?? ""}
    />
  );
}
