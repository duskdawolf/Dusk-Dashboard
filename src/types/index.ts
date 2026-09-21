export type EventItem = {
  id: string;
  slug: string;
  title: string;
  startAt: string;
  endAt?: string;
  location?: string;
  description: string;
  tag: string;
  quarter: "q1" | "q2" | "q3" | "q4";
  mapX?: number;
  mapY?: number;
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
  slug: string;
  title: string;
  image: string;
  status: string;
  challenge: string;
  solution: string;
  outcome: string;
};
