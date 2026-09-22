export type EventQuarter = "q1" | "q2" | "q3" | "q4";
export type EventType = "convention" | "meetup" | "hosting" | "public";

export type EventItem = {
  id: string;
  slug: string;
  title: string;
  startAt: string;
  endAt?: string;
  location?: string;
  stateCode?: string;
  latitude?: number;
  longitude?: number;
  description: string;
  tag: string;
  eventType: EventType;
  quarter: EventQuarter;
};

export type SocialLink = {
  id: string;
  name: string;
  handle: string;
  url: string;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  image: string;
  description: string;
  priceLabel: string;
  active: boolean;
};

export type CaseStudy = {
  id: string;
  eventId?: string;
  slug: string;
  title: string;
  image: string;
  status: string;
  challenge: string;
  solution: string;
  outcome: string;
};

export type MediaItem = {
  id: string;
  title: string;
  kind: "image" | "video";
  url: string;
  storagePath?: string;
  mimeType?: string;
  altText?: string;
  caption?: string;
  eventId?: string;
  published: boolean;
  createdAt?: string;
};

export type PostStatus =
  | "draft"
  | "approved"
  | "scheduled"
  | "published"
  | "failed";

export type SocialPlatform =
  | "telegram"
  | "twitter"
  | "instagram"
  | "snapchat";

export type SocialPost = {
  id: string;
  eventId?: string;
  title: string;
  masterCaption: string;
  status: PostStatus;
  scheduledAt?: string;
  approvedAt?: string;
  automationStatus?: string;
  createdAt?: string;
};

export type ConPrep = {
  id: string;
  eventId: string;
  status: "planning" | "ready" | "traveling" | "complete";
  targetArrivalAt?: string;
  leaveForAirportAt?: string;
  packingDeadline?: string;
  notes?: string;
};


export type ChaosArchiveItem = {
  event: EventItem;
  caseStudy?: CaseStudy;
  coverImage?: string;
  mediaCount: number;
  incidentFiled: boolean;
};
