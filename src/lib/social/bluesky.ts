import type {
  SocialMediaAsset,
  SocialProviderStatus,
  SocialPublishJob,
  SocialPublishResult,
} from "@/lib/social/types";

const DEFAULT_PDS = "https://bsky.social";
const MAX_GRAPHEMES = 300;
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 2_000_000;

type SessionResponse = {
  accessJwt?: string;
  refreshJwt?: string;
  handle?: string;
  did?: string;
  active?: boolean;
  error?: string;
  message?: string;
};

type BlobResponse = {
  blob?: {
    $type?: string;
    ref?: { $link?: string };
    mimeType?: string;
    size?: number;
  };
  error?: string;
  message?: string;
};

type CreateRecordResponse = {
  uri?: string;
  cid?: string;
  error?: string;
  message?: string;
};

function config() {
  return {
    identifier: process.env.BLUESKY_IDENTIFIER?.trim() || "",
    password: process.env.BLUESKY_APP_PASSWORD?.trim() || "",
    pds: (
      process.env.BLUESKY_PDS_URL?.trim() || DEFAULT_PDS
    ).replace(/\/$/, ""),
  };
}

export function blueskyConfigured() {
  const cfg = config();
  return Boolean(cfg.identifier && cfg.password && cfg.pds);
}

export function blueskyGraphemeLength(value: string) {
  const Segmenter = (Intl as any).Segmenter;

  if (Segmenter) {
    const segmenter = new Segmenter(undefined, {
      granularity: "grapheme",
    });

    return Array.from(segmenter.segment(value)).length;
  }

  return Array.from(value).length;
}

async function createSession() {
  const cfg = config();

  if (!blueskyConfigured()) {
    throw new Error(
      "Bluesky is not configured. Set BLUESKY_IDENTIFIER and BLUESKY_APP_PASSWORD in Vercel.",
    );
  }

  const response = await fetch(
    `${cfg.pds}/xrpc/com.atproto.server.createSession`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: cfg.identifier,
        password: cfg.password,
      }),
      cache: "no-store",
    },
  );

  const body = (await response
    .json()
    .catch(() => ({}))) as SessionResponse;

  if (
    !response.ok ||
    !body.accessJwt ||
    !body.did ||
    !body.handle
  ) {
    throw new Error(
      body.message ||
        body.error ||
        `Bluesky login failed with HTTP ${response.status}.`,
    );
  }

  return {
    ...body,
    pds: cfg.pds,
    accessJwt: body.accessJwt,
    did: body.did,
    handle: body.handle,
  };
}

function trimUrlPunctuation(raw: string) {
  return raw.replace(/[),.!?;:]+$/u, "");
}

function linkFacets(text: string) {
  const facets: Array<{
    index: { byteStart: number; byteEnd: number };
    features: Array<{
      $type: "app.bsky.richtext.facet#link";
      uri: string;
    }>;
  }> = [];

  const expression = /https?:\/\/[^\s<>{}\[\]"']+/gu;

  for (const match of text.matchAll(expression)) {
    const raw = match[0];
    const uri = trimUrlPunctuation(raw);
    const charStart = match.index ?? 0;
    const charEnd = charStart + uri.length;

    const byteStart = Buffer.byteLength(
      text.slice(0, charStart),
      "utf8",
    );
    const byteEnd = Buffer.byteLength(
      text.slice(0, charEnd),
      "utf8",
    );

    facets.push({
      index: { byteStart, byteEnd },
      features: [
        {
          $type: "app.bsky.richtext.facet#link",
          uri,
        },
      ],
    });
  }

  return facets;
}

async function fetchImage(asset: SocialMediaAsset) {
  const response = await fetch(asset.url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Could not download ${asset.title}: HTTP ${response.status}.`,
    );
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const mimeType =
    asset.mime_type ||
    response.headers.get("content-type") ||
    "image/jpeg";

  if (!mimeType.toLowerCase().startsWith("image/")) {
    throw new Error(
      `${asset.title} is not an image and cannot be attached to a v25.3 Bluesky post.`,
    );
  }

  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new Error(
      `${asset.title} is ${Math.ceil(
        bytes.length / 1024,
      )} KB. Bluesky images must be 2 MB or smaller.`,
    );
  }

  return { bytes, mimeType };
}

async function uploadImage(
  pds: string,
  accessJwt: string,
  asset: SocialMediaAsset,
) {
  const { bytes, mimeType } = await fetchImage(asset);

  const response = await fetch(
    `${pds}/xrpc/com.atproto.repo.uploadBlob`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessJwt}`,
        "Content-Type": mimeType,
      },
      body: bytes,
      cache: "no-store",
    },
  );

  const body = (await response
    .json()
    .catch(() => ({}))) as BlobResponse;

  if (!response.ok || !body.blob) {
    throw new Error(
      body.message ||
        body.error ||
        `Bluesky image upload failed with HTTP ${response.status}.`,
    );
  }

  return {
    alt: (asset.alt_text || asset.title || "").slice(0, 2000),
    image: body.blob,
  };
}

export function validateBlueskyJob(job: SocialPublishJob) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const graphemes = blueskyGraphemeLength(job.caption);

  if (!blueskyConfigured()) {
    errors.push(
      "Bluesky is not configured in Vercel.",
    );
  }

  if (graphemes > MAX_GRAPHEMES) {
    errors.push(
      `Bluesky text is ${graphemes} graphemes; maximum is ${MAX_GRAPHEMES}.`,
    );
  }

  if (job.media.length > MAX_IMAGES) {
    errors.push(
      `Bluesky supports at most ${MAX_IMAGES} images in this v25.3 publisher.`,
    );
  }

  const videos = job.media.filter(
    (asset) => asset.kind === "video",
  );

  if (videos.length) {
    errors.push(
      "Bluesky video publishing is not enabled in v25.3 yet. Use text and up to four images.",
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export async function getBlueskyProviderStatus(): Promise<SocialProviderStatus> {
  const base: SocialProviderStatus = {
    platform: "bluesky",
    label: "Bluesky",
    configured: blueskyConfigured(),
    live: true,
    connected: false,
    detail:
      "v25.3 live provider using AT Protocol password-session publishing.",
    capabilities: {
      text: true,
      photo: true,
      video: false,
      carousel: true,
      maxMedia: MAX_IMAGES,
      maxText: MAX_GRAPHEMES,
      maxCaption: MAX_GRAPHEMES,
      analytics: false,
    },
  };

  if (!base.configured) {
    return {
      ...base,
      detail:
        "Set BLUESKY_IDENTIFIER and BLUESKY_APP_PASSWORD in Vercel. Use a Bluesky app password rather than your main account password.",
    };
  }

  try {
    const session = await createSession();

    return {
      ...base,
      connected: true,
      account: `@${session.handle}`,
      target: session.did,
      detail:
        "Bluesky credentials validated. Text and up to four-image posts are live.",
    };
  } catch (error) {
    return {
      ...base,
      error:
        error instanceof Error
          ? error.message
          : "Bluesky authentication failed.",
      detail:
        "Bluesky credentials are configured but could not be validated.",
    };
  }
}

export async function publishBluesky(
  job: SocialPublishJob,
): Promise<SocialPublishResult> {
  const validation = validateBlueskyJob(job);

  if (!validation.valid) {
    return {
      ok: false,
      retryable: false,
      error: validation.errors.join(" "),
      providerResponse: { validation },
    };
  }

  let session: Awaited<ReturnType<typeof createSession>>;

  try {
    session = await createSession();
  } catch (error) {
    return {
      ok: false,
      retryable: false,
      error:
        error instanceof Error
          ? error.message
          : "Bluesky authentication failed.",
    };
  }

  try {
    const images = [];

    for (const asset of job.media) {
      images.push(
        await uploadImage(
          session.pds,
          session.accessJwt,
          asset,
        ),
      );
    }

    const record: Record<string, unknown> = {
      $type: "app.bsky.feed.post",
      text: job.caption,
      createdAt: new Date().toISOString(),
      langs: ["en-US"],
    };

    const facets = linkFacets(job.caption);
    if (facets.length) {
      record.facets = facets;
    }

    if (images.length) {
      record.embed = {
        $type: "app.bsky.embed.images",
        images,
      };
    }

    const response = await fetch(
      `${session.pds}/xrpc/com.atproto.repo.createRecord`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessJwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repo: session.did,
          collection: "app.bsky.feed.post",
          record,
        }),
        cache: "no-store",
      },
    );

    const body = (await response
      .json()
      .catch(() => ({}))) as CreateRecordResponse;

    if (!response.ok || !body.uri) {
      const retryable =
        response.status === 429 || response.status >= 500;

      return {
        ok: false,
        retryable,
        retryAfterSeconds:
          Number(response.headers.get("retry-after") || 0) ||
          null,
        error:
          body.message ||
          body.error ||
          `Bluesky createRecord failed with HTTP ${response.status}.`,
        providerResponse: body as Record<string, unknown>,
      };
    }

    const rkey = body.uri.split("/").pop() || "";

    return {
      ok: true,
      retryable: false,
      providerAccount: `@${session.handle}`,
      providerPostId: body.uri,
      postUrl: rkey
        ? `https://bsky.app/profile/${session.handle}/post/${rkey}`
        : null,
      publishedCaption: job.caption,
      publishedMedia: job.media,
      providerResponse: {
        uri: body.uri,
        cid: body.cid ?? null,
        did: session.did,
        handle: session.handle,
        facets,
      },
    };
  } catch (error) {
    return {
      ok: false,
      retryable: false,
      error:
        error instanceof Error
          ? error.message
          : "Bluesky publishing failed.",
    };
  }
}
