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

export const LIVE_SOCIAL_PLATFORMS: SocialPlatform[] = [
  "telegram",
  "twitter",
  "instagram",
];

export function platformIsLive(platform: SocialPlatform) {
  return LIVE_SOCIAL_PLATFORMS.includes(platform);
}

export function platformIsConfigured(platform: SocialPlatform) {
  if (platform === "telegram") return telegramConfigured();
  if (platform === "twitter") return xOAuthConfigured();
  if (platform === "instagram") return instagramOAuthConfigured();
  return false;
}

export function platformDisplayName(platform: SocialPlatform) {
  if (platform === "twitter") return "X";
  if (platform === "instagram") return "Instagram";
  if (platform === "telegram") return "Telegram";
  return "Snapchat";
}

export function validateSocialJob(job: SocialPublishJob) {
  if (job.platform === "telegram") return validateTelegramJob(job);
  if (job.platform === "twitter") return validateXJob(job);
  if (job.platform === "instagram") return validateInstagramJob(job);

  return {
    valid: false,
    errors: [
      `${job.platform} publishing is not live in v25.2. Keep it Draft/Approved until its provider release.`,
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

  return {
    ok: false,
    retryable: false,
    error: `${job.platform} publishing is not live in v25.2.`,
  };
}

export async function getSocialProviderStatuses(
  userId?: string,
): Promise<SocialProviderStatus[]> {
  const [telegram, twitter, instagram] = await Promise.all([
    getTelegramProviderStatus(),
    getXProviderStatus(userId),
    getInstagramProviderStatus(userId),
  ]);

  return [
    telegram,
    twitter,
    instagram,
    {
      platform: "snapchat",
      label: "Snapchat",
      configured: false,
      live: false,
      connected: false,
      detail: "Assisted handoff planned for v25.3.",
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
