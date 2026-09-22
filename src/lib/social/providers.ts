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

export const LIVE_SOCIAL_PLATFORMS: SocialPlatform[] = ["telegram"];

export function platformIsLive(platform: SocialPlatform) {
  return LIVE_SOCIAL_PLATFORMS.includes(platform);
}

export function platformIsConfigured(platform: SocialPlatform) {
  if (platform === "telegram") return telegramConfigured();
  return false;
}

export function validateSocialJob(job: SocialPublishJob) {
  if (job.platform === "telegram") return validateTelegramJob(job);

  return {
    valid: false,
    errors: [
      `${job.platform} publishing is not live in v25.0. Keep it Draft/Approved until its provider release.`,
    ],
    warnings: [],
  };
}

export async function publishSocialJob(
  job: SocialPublishJob,
): Promise<SocialPublishResult> {
  if (job.platform === "telegram") {
    return publishTelegram(job);
  }

  return {
    ok: false,
    retryable: false,
    error: `${job.platform} publishing is not live in v25.0.`,
  };
}

export async function getSocialProviderStatuses(): Promise<
  SocialProviderStatus[]
> {
  const telegram = await getTelegramProviderStatus();

  return [
    telegram,
    {
      platform: "twitter",
      label: "X",
      configured: false,
      live: false,
      connected: false,
      detail: "Provider adapter reserved for v25.1.",
      capabilities: {
        text: true,
        photo: true,
        video: true,
        carousel: true,
        maxMedia: null,
        maxText: null,
        maxCaption: null,
        analytics: false,
      },
    },
    {
      platform: "instagram",
      label: "Instagram",
      configured: false,
      live: false,
      connected: false,
      detail: "Provider adapter reserved for v25.2.",
      capabilities: {
        text: true,
        photo: true,
        video: true,
        carousel: true,
        maxMedia: null,
        maxText: null,
        maxCaption: null,
        analytics: false,
      },
    },
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
