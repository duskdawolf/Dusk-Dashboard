import { redirect } from "next/navigation";

export default async function LegacyIncidentReportRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/deployments/${encodeURIComponent(slug)}`);
}
