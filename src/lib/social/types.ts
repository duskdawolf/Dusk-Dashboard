export type SocialPlatform =
  | "telegram"
  | "twitter"
  | "instagram"
  | "bluesky"
  | "snapchat";

export type SocialMediaAsset = {
  id: string;
  title: string;
  kind: "image" | "video";
  url: string;
  mime_type?: string | null;
  alt_text?: string | null;
  caption?: string | null;
};

export type SocialPublishJob = {
  platformId: string;
  postId: string;
  platform: SocialPlatform;
  title: string;
  caption: string;
  scheduledAt: string | null;
  includeDeploymentLink?: boolean;
  providerState?: Record<string, unknown>;
  event?: {
    id: string;
    slug: string;
    title: string;
    location?: string | null;
    start_at?: string | null;
  } | null;
  media: SocialMediaAsset[];
};

export type SocialProviderStatus = {
  platform: SocialPlatform;
  label: string;
  configured: boolean;
  live: boolean;
  connected: boolean;
  account?: string | null;
  target?: string | null;
  detail: string;
  error?: string | null;
  capabilities: {
    text: boolean;
    photo: boolean;
    video: boolean;
    carousel: boolean;
    maxMedia?: number | null;
    maxText?: number | null;
    maxCaption?: number | null;
    analytics: boolean;
  };
};

export type SocialPublishResult = {
  ok: boolean;
  retryable: boolean;
  retryAfterSeconds?: number | null;
  providerAccount?: string | null;
  providerPostId?: string | null;
  postUrl?: string | null;
  publishedCaption?: string | null;
  publishedMedia?: SocialMediaAsset[];
  providerResponse?: Record<string, unknown>;
  error?: string | null;
};
