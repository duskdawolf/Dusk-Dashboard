import type { SocialPlatform, SocialProviderStatus, SocialPublishJob, SocialPublishResult } from "@/lib/social/types";
import { getTelegramProviderStatus, publishTelegram, telegramConfigured, validateTelegramJob } from "@/lib/social/telegram";
import { getXProviderStatus, publishX, validateXJob, xOAuthConfigured } from "@/lib/social/x";

export const LIVE_SOCIAL_PLATFORMS: SocialPlatform[] = ["telegram", "twitter"];
export function platformIsLive(platform: SocialPlatform) { return LIVE_SOCIAL_PLATFORMS.includes(platform); }
export function platformIsConfigured(platform: SocialPlatform) {
  if (platform === "telegram") return telegramConfigured();
  if (platform === "twitter") return xOAuthConfigured();
  return false;
}
export function validateSocialJob(job: SocialPublishJob) {
  if (job.platform === "telegram") return validateTelegramJob(job);
  if (job.platform === "twitter") return validateXJob(job);
  return { valid: false, errors: [`${job.platform} publishing is not live in v25.1. Keep it Draft/Approved until its provider release.`], warnings: [] };
}
export async function publishSocialJob(job: SocialPublishJob): Promise<SocialPublishResult> {
  if (job.platform === "telegram") return publishTelegram(job);
  if (job.platform === "twitter") return publishX(job);
  return { ok: false, retryable: false, error: `${job.platform} publishing is not live in v25.1.` };
}
export async function getSocialProviderStatuses(userId?: string): Promise<SocialProviderStatus[]> {
  const [telegram, twitter] = await Promise.all([getTelegramProviderStatus(), getXProviderStatus(userId)]);
  return [
    telegram,
    twitter,
    { platform: "instagram", label: "Instagram", configured: false, live: false, connected: false, detail: "Provider adapter reserved for v25.2.", capabilities: { text: true, photo: true, video: true, carousel: true, maxMedia: null, maxText: null, maxCaption: null, analytics: false } },
    { platform: "snapchat", label: "Snapchat", configured: false, live: false, connected: false, detail: "Assisted handoff planned for v25.3.", capabilities: { text: true, photo: true, video: true, carousel: false, maxMedia: null, maxText: null, maxCaption: null, analytics: false } },
  ];
}
