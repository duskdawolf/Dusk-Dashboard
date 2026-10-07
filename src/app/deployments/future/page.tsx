import { DeploymentArchivePage } from "@/components/DeploymentArchivePage";

export const metadata = { title: "Tactical Deployment Plans" };
export const dynamic = "force-dynamic";

export default async function FutureDeploymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.tag) ? params.tag[0] : params.tag;

  return (
    <DeploymentArchivePage
      mode="future"
      tag={raw?.trim() ?? ""}
    />
  );
}
