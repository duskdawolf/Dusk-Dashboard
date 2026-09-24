export type ReviewPlatform =
  | "telegram"
  | "twitter"
  | "instagram"
  | "bluesky";

export type SocialReviewSubmission = {
  postId?: string | null;
  title: string;
  masterCaption: string;
  eventId?: string | null;
  includeDeploymentLink: boolean;
  scheduledAt?: string | null;
  platforms: Array<{
    platform: ReviewPlatform;
    captionOverride?: string | null;
    scheduledAt?: string | null;
  }>;
  mediaIds: string[];
};

export type SocialReviewSource = {
  title: string;
  url: string;
};

export type SocialReview = {
  summary: string;
  reachAssessment: string;
  dataBasis: {
    mode: "dusk" | "mixed" | "web" | "general";
    confidence: "low" | "moderate" | "high";
    explanation: string;
    internalSamples: number;
  };
  wording: {
    assessment: string;
    recommendedMasterCaption: string;
    reason: string;
  };
  platformReviews: Array<{
    platform: ReviewPlatform;
    verdict: string;
    recommendedCaption: string;
    recommendedScheduledAt: string | null;
    timingRationale: string;
    timingBasis: "dusk" | "web" | "general";
    confidence: "low" | "moderate" | "high";
    mediaAdvice: string;
    includeDeploymentLink: boolean;
    deploymentLinkRationale: string;
  }>;
  media: {
    assessment: string;
    recommendedOrder: string[];
    rationale: string;
  };
  quickWins: string[];
  chatReply: string;
  webUsed: boolean;
  sources: SocialReviewSource[];
};
