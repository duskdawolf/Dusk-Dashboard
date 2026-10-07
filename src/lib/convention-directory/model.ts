import { z } from "zod";

export function safePublicUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443")
    )
      return null;
    if (
      !url.hostname.includes(".") ||
      /(^|\.)(localhost|local|internal|test|invalid)$/.test(url.hostname) ||
      /^[\d.]+$/.test(url.hostname) ||
      url.hostname.includes(":")
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

const url = z
  .string()
  .max(2000)
  .refine(
    (s) => Boolean(safePublicUrl(s)),
    "Use a public HTTPS URL without credentials",
  );
const text = z.string().max(6000).nullable().optional();
const link = url.nullable().optional();
const timestamp = z.string().datetime({ offset: true }).nullable().optional();
export const HotelSchema = z
  .object({
    source_key: z.string().min(1).max(240),
    name: z.string().min(1).max(240),
    role: z.enum(["main", "overflow", "secondary", "staff", "other"]),
    address: text,
    booking_url: link,
    booking_opens_at: timestamp,
    booking_closes_at: timestamp,
    block_info: text,
    source_url: url,
  })
  .strict();
export const EditionSchema = z
  .object({
    edition_key: z.string().min(1).max(500),
    name: z.string().min(1).max(240),
    edition_year: z.number().int().min(1900).max(2200).nullable().optional(),
    start_at: timestamp,
    end_at: timestamp,
    timezone: z.string().max(100).nullable().optional(),
    date_precision: z.enum(["date_only", "exact", "unknown"]).optional(),
    status: z.enum(["scheduled", "postponed", "cancelled"]).optional(),
    venue_name: text,
    venue_address: text,
    location: text,
    theme: text,
    website_url: url,
    registration_url: link,
    registration_info: text,
    schedule_url: link,
    schedule_info: text,
    policies_url: link,
    policies_info: text,
    social_url: link,
    banner_url: link,
    logo_url: link,
    hotels: z.array(HotelSchema).max(40).optional(),
    sources: z
      .array(z.object({ field_name: z.string().min(1).max(100), url }).strict())
      .max(80)
      .optional(),
  })
  .strict()
  .refine(
    (e) =>
      !e.start_at ||
      !e.end_at ||
      Date.parse(e.end_at) >= Date.parse(e.start_at),
    "End must follow start",
  )
  .refine(
    (e) =>
      !e.hotels ||
      new Set(e.hotels.map((h) => h.source_key)).size === e.hotels.length,
    "Hotel source keys must be unique",
  );
export type EditionFacts = z.infer<typeof EditionSchema>;
export type PublicEdition = Omit<EditionFacts, "hotels" | "sources"> & {
  id: string;
  series_id: string;
  series_name: string;
  verified_at: string;
  facts_changed_at?: string;
  series_logo_url?: string | null;
  hotels?: (z.infer<typeof HotelSchema> & { verified_at?: string })[];
  sources?: { field_name: string; url: string; verified_at?: string }[];
};

export const DIRECTORY_PLACEHOLDER = "/assets/deployment-placeholder.svg";
export function deploymentImages(
  featured?: string | null,
  edition?: PublicEdition | null,
): string[] {
  return [
    ...new Set(
      [
        featured,
        edition?.banner_url,
        edition?.logo_url,
        edition?.series_logo_url,
      ].filter((s): s is string =>
        Boolean(s && (s.startsWith("/assets/") || safePublicUrl(s))),
      ),
    ),
    DIRECTORY_PLACEHOLDER,
  ];
}

export function sameOfficialHost(source: string, candidate: string): boolean {
  if (!safePublicUrl(source) || !safePublicUrl(candidate)) return false;
  return (
    new URL(source).hostname.replace(/^www\./, "") ===
    new URL(candidate).hostname.replace(/^www\./, "")
  );
}

export function officialEvidenceAllowed(
  primary: string,
  sources: { url: string; kind: string }[],
  candidate: string,
): boolean {
  if (sameOfficialHost(primary, candidate)) return true;
  return sources.some((source) => {
    if (!sameOfficialHost(source.url, candidate)) return false;
    if (source.kind === "website") return true;
    const path = new URL(source.url).pathname.replace(/\/$/, "");
    const proposedPath = new URL(candidate).pathname;
    // Approval of one official social account does not approve the entire platform.
    return proposedPath === path || proposedPath.startsWith(`${path}/`);
  });
}

// Only structured facts are imported. No page text, prompts or arbitrary AI writes.
export function parseDirectorySource(
  body: string,
  format: string,
  source: string,
): EditionFacts[] {
  if (format === "directory-json") {
    const parsed = z
      .object({ editions: z.array(EditionSchema).min(1).max(100) })
      .strict()
      .parse(JSON.parse(body));
    if (
      new Set(parsed.editions.map((e) => e.edition_key)).size !==
      parsed.editions.length
    )
      throw new Error("Duplicate edition keys in source");
    return parsed.editions;
  }
  const nodes: Record<string, any>[] = [];
  function walk(value: any) {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (!value || typeof value !== "object") return;
    if ([value["@type"]].flat().some((t) => t === "Event" || t === "Festival"))
      nodes.push(value);
    if (value["@graph"]) walk(value["@graph"]);
    if (value.itemListElement) walk(value.itemListElement);
    if (value.item) walk(value.item);
  }
  for (const match of body.matchAll(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  ))
    walk(JSON.parse(match[1]));
  const result = nodes.slice(0, 100).map((n) => {
    const identity = n["@id"] || n.url;
    // Never identify an edition using its name or year alone.
    if (typeof identity !== "string")
      throw new Error("Official Event metadata needs a stable @id or URL");
    const place = Array.isArray(n.location) ? n.location[0] : n.location;
    const address = place?.address;
    const location =
      typeof address === "string"
        ? address
        : [
            address?.addressLocality,
            address?.addressRegion,
            address?.addressCountry,
          ]
            .filter(Boolean)
            .join(", ");
    const date = (s: unknown) =>
      typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s)
        ? `${s}T00:00:00.000Z`
        : s;
    const facts: Record<string, unknown> = {
      edition_key: new URL(identity, source).href,
      name: n.name,
      website_url: new URL(n.url || identity, source).href,
    };
    if (n.startDate) {
      facts.start_at = date(n.startDate);
      facts.edition_year = Number(n.startDate.slice(0, 4));
      facts.date_precision = n.startDate.length === 10 ? "date_only" : "exact";
    }
    if (n.endDate) facts.end_at = date(n.endDate);
    if (place?.name) facts.venue_name = place.name;
    if (address?.streetAddress) facts.venue_address = address.streetAddress;
    if (location) facts.location = location;
    if (n.eventStatus)
      facts.status = String(n.eventStatus).endsWith("EventCancelled")
        ? "cancelled"
        : String(n.eventStatus).endsWith("EventPostponed")
          ? "postponed"
          : "scheduled";
    const image = Array.isArray(n.image) ? n.image[0] : n.image;
    if (image) facts.banner_url = typeof image === "string" ? image : image.url;
    return EditionSchema.parse(facts);
  });
  if (!result.length)
    throw new Error(
      "No supported official Event metadata found; curate the edition or configure a directory JSON feed",
    );
  if (new Set(result.map((e) => e.edition_key)).size !== result.length)
    throw new Error("Duplicate official Event identities");
  return result;
}
