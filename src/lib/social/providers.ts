import type {
  SocialPlatform,
  SocialProviderStatus,
  SocialPublishJob,
  SocialPublishResult,
} from "@/lib/social/types";
import {
  getTelegramProviderStatus,
  publishTelegram,
  telegramConfigured,
  validateTelegramJob,
} from "@/lib/social/telegram";
import {
  getXProviderStatus,
  publishX,
  validateXJob,
  xOAuthConfigured,
} from "@/lib/social/x";
import {
  getInstagramProviderStatus,
  instagramOAuthConfigured,
  publishInstagram,
  validateInstagramJob,
} from "@/lib/social/instagram";
import {
  blueskyConfigured,
  getBlueskyProviderStatus,
  publishBluesky,
  validateBlueskyJob,
} from "@/lib/social/bluesky";

export const LIVE_SOCIAL_PLATFORMS: SocialPlatform[] = [
  "telegram",
  "twitter",
  "instagram",
  "bluesky",
];

export function platformIsLive(platform: SocialPlatform) {
  return LIVE_SOCIAL_PLATFORMS.includes(platform);
}

export function platformIsConfigured(platform: SocialPlatform) {
  if (platform === "telegram") return telegramConfigured();
  if (platform === "twitter") return xOAuthConfigured();
  if (platform === "instagram") return instagramOAuthConfigured();
  if (platform === "bluesky") return blueskyConfigured();
  return false;
}

export function platformDisplayName(platform: SocialPlatform) {
  if (platform === "twitter") return "X";
  if (platform === "instagram") return "Instagram";
  if (platform === "bluesky") return "Bluesky";
  if (platform === "telegram") return "Telegram";
  return "Snapchat";
}

export function validateSocialJob(job: SocialPublishJob) {
  if (job.platform === "telegram") return validateTelegramJob(job);
  if (job.platform === "twitter") return validateXJob(job);
  if (job.platform === "instagram") return validateInstagramJob(job);
  if (job.platform === "bluesky") return validateBlueskyJob(job);

  return {
    valid: false,
    errors: [
      `${job.platform} publishing is not live in v25.3. Keep it Draft/Approved until its provider release.`,
    ],
    warnings: [],
  };
}

export async function publishSocialJob(
  job: SocialPublishJob,
): Promise<SocialPublishResult> {
  if (job.platform === "telegram") return publishTelegram(job);
  if (job.platform === "twitter") return publishX(job);
  if (job.platform === "instagram") return publishInstagram(job);
  if (job.platform === "bluesky") return publishBluesky(job);

  return {
    ok: false,
    retryable: false,
    error: `${job.platform} publishing is not live in v25.3.`,
  };
}

export async function getSocialProviderStatuses(
  userId?: string,
): Promise<SocialProviderStatus[]> {
  const [telegram, twitter, instagram, bluesky] = await Promise.all([
    getTelegramProviderStatus(),
    getXProviderStatus(userId),
    getInstagramProviderStatus(userId),
    getBlueskyProviderStatus(),
  ]);

  return [
    telegram,
    twitter,
    instagram,
    bluesky,
    {
      platform: "snapchat",
      label: "Snapchat",
      configured: false,
      live: false,
      connected: false,
      detail: "Snapchat integration postponed; no live provider in v25.3.",
      capabilities: {
        text: true,
        photo: true,
        video: true,
        carousel: false,
        maxMedia: null,
        maxText: null,
        maxCaption: null,
        analytics: false,
      },
    },
  ];
}
