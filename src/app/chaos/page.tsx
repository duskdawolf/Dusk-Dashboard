import { redirect } from "next/navigation";

export default async function LegacyChaosPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.tag) ? params.tag[0] : params.tag;

  redirect(
    `/deployments/past${
      raw?.trim()
        ? `?tag=${encodeURIComponent(raw.trim())}`
        : ""
    }`,
  );
}
