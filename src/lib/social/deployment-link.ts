export type DeploymentLinkEvent = {
  slug: string;
  start_at?: string | null;
};

export function deploymentDocumentLabel(
  event: DeploymentLinkEvent,
  now = Date.now(),
) {
  const startsAt = event.start_at
    ? new Date(event.start_at).getTime()
    : Number.NaN;

  return Number.isFinite(startsAt) && startsAt > now
    ? "Tactical Deployment Plan"
    : "Incident Report";
}

export function deploymentDocumentUrl(
  event: DeploymentLinkEvent,
) {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://duskdawolf.com";

  return `${base}/chaos/${encodeURIComponent(event.slug)}`;
}

export function deploymentLinkSuffix(
  event?: DeploymentLinkEvent | null,
) {
  if (!event?.slug) return "";

  return `\n\n${deploymentDocumentLabel(event)}: ${deploymentDocumentUrl(event)}`;
}

export function withDeploymentLink(
  caption: string,
  event?: DeploymentLinkEvent | null,
  enabled = false,
) {
  if (!enabled || !event?.slug) return caption;

  const suffix = deploymentLinkSuffix(event);

  if (!suffix || caption.includes(deploymentDocumentUrl(event))) {
    return caption;
  }

  return `${caption.trimEnd()}${suffix}`;
}
