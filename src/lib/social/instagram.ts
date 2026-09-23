import crypto from "crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { getAdminUserIds } from "@/lib/notifications";
import {
  decryptSocialSecret,
  encryptSocialSecret,
} from "@/lib/social/crypto";
import type {
  SocialMediaAsset,
  SocialProviderStatus,
  SocialPublishJob,
  SocialPublishResult,
} from "@/lib/social/types";

const INSTAGRAM_AUTHORIZE = "https://www.instagram.com/oauth/authorize";
const INSTAGRAM_TOKEN = "https://api.instagram.com/oauth/access_token";
const INSTAGRAM_GRAPH = "https://graph.instagram.com";
const CAPTION_LIMIT = 2200;
const MAX_MEDIA = 10;

type ConnectionRow = {
  id: string;
  user_id: string;
  platform: "instagram";
  provider_user_id: string | null;
  username: string | null;
  display_name: string | null;
  access_token_ciphertext: string;
  refresh_token_ciphertext: string | null;
  token_type: string;
  scope: string | null;
  expires_at: string | null;
  connected_at: string;
  last_refreshed_at: string | null;
  last_error: string | null;
  metadata: Record<string, unknown> | null;
};

type IgTokenResponse = {
  access_token?: string;
  user_id?: number | string;
  permissions?: string[];
  token_type?: string;
  expires_in?: number;
  error_type?: string;
  code?: number;
  error_message?: string;
};

type IgGraphError = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
  is_transient?: boolean;
};

type IgProfileResponse = {
  id?: string;
  user_id?: string;
  username?: string;
  account_type?: string;
  error?: IgGraphError;
};

type IgContainerResponse = {
  id?: string;
  error?: IgGraphError;
};

type IgContainerStatusResponse = {
  id?: string;
  status_code?: "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";
  status?: string;
  error?: IgGraphError;
};

type IgMediaResponse = {
  id?: string;
  permalink?: string;
  media_type?: string;
  media_product_type?: string;
  error?: IgGraphError;
};

function config() {
  return {
    appId: process.env.INSTAGRAM_APP_ID?.trim() || "",
    appSecret: process.env.INSTAGRAM_APP_SECRET?.trim() || "",
    version: process.env.INSTAGRAM_GRAPH_VERSION?.trim() || "v25.0",
  };
}

function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://duskdawolf.com"
  );
}

function graphBase() {
  return `${INSTAGRAM_GRAPH}/${config().version}`;
}

export function instagramRedirectUri() {
  return `${siteUrl()}/api/admin/social/instagram/callback`;
}

export function instagramOAuthConfigured() {
  const cfg = config();
  return Boolean(
    cfg.appId &&
      cfg.appSecret &&
      process.env.SOCIAL_TOKEN_ENCRYPTION_KEY,
  );
}

export function createInstagramAuthorizationRequest() {
  const cfg = config();

  if (!instagramOAuthConfigured()) {
    throw new Error(
      "Instagram OAuth is not configured. Set INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, and SOCIAL_TOKEN_ENCRYPTION_KEY.",
    );
  }

  const state = crypto.randomBytes(32).toString("base64url");
  const params = new URLSearchParams({
    client_id: cfg.appId,
    redirect_uri: instagramRedirectUri(),
    response_type: "code",
    scope: [
      "instagram_business_basic",
      "instagram_business_content_publish",
    ].join(","),
    state,
    enable_fb_login: "0",
    force_reauth: "true",
  });

  return {
    state,
    url: `${INSTAGRAM_AUTHORIZE}?${params.toString()}`,
  };
}

async function exchangeShortLivedToken(code: string) {
  const cfg = config();
  const form = new FormData();

  form.set("client_id", cfg.appId);
  form.set("client_secret", cfg.appSecret);
  form.set("grant_type", "authorization_code");
  form.set("redirect_uri", instagramRedirectUri());
  form.set("code", code);

  const response = await fetch(INSTAGRAM_TOKEN, {
    method: "POST",
    body: form,
    cache: "no-store",
  });

  const body = (await response.json().catch(() => ({}))) as IgTokenResponse;

  if (!response.ok || !body.access_token) {
    throw new Error(
      body.error_message ||
        `Instagram authorization-code exchange failed with HTTP ${response.status}.`,
    );
  }

  return body;
}

async function exchangeLongLivedToken(shortToken: string) {
  const params = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: config().appSecret,
    access_token: shortToken,
  });

  const response = await fetch(
    `${INSTAGRAM_GRAPH}/access_token?${params.toString()}`,
    { cache: "no-store" },
  );
  const body = (await response.json().catch(() => ({}))) as IgTokenResponse;

  if (!response.ok || !body.access_token) {
    throw new Error(
      body.error_message ||
        `Instagram long-lived token exchange failed with HTTP ${response.status}.`,
    );
  }

  return body;
}

export async function exchangeInstagramAuthorizationCode(code: string) {
  const short = await exchangeShortLivedToken(code);
  return exchangeLongLivedToken(short.access_token!);
}

async function igRequest<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
) {
  try {
    const response = await fetch(`${graphBase()}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });

    const body = (await response.json().catch(() => ({}))) as T & {
      error?: IgGraphError;
    };

    return {
      ok: response.ok && !body.error,
      status: response.status,
      body,
      error:
        body.error?.message ||
        (!response.ok
          ? `Instagram returned HTTP ${response.status}.`
          : null),
      errorCode: body.error?.code ?? null,
      errorSubcode: body.error?.error_subcode ?? null,
      transient: Boolean(body.error?.is_transient),
      retryAfter:
        Number(response.headers.get("retry-after") || 0) || null,
    };
  } catch (error) {
    return {
      ok: false,
      status: 599,
      body: {} as T,
      error:
        error instanceof Error ? error.message : "Instagram network error.",
      errorCode: null,
      errorSubcode: null,
      transient: true,
      retryAfter: null,
    };
  }
}

async function getInstagramProfile(accessToken: string) {
  const result = await igRequest<IgProfileResponse>(
    accessToken,
    "/me?fields=id,user_id,username,account_type",
  );

  if (!result.ok || !result.body.username) {
    throw new Error(
      result.error ||
        "Could not identify the connected Instagram professional account.",
    );
  }

  return result.body;
}

async function refreshInstagramToken(connection: ConnectionRow) {
  const accessToken = decryptSocialSecret(
    connection.access_token_ciphertext,
  );

  const params = new URLSearchParams({
    grant_type: "ig_refresh_token",
    access_token: accessToken,
  });

  const response = await fetch(
    `${INSTAGRAM_GRAPH}/refresh_access_token?${params.toString()}`,
    { cache: "no-store" },
  );

  const body = (await response.json().catch(() => ({}))) as IgTokenResponse;

  if (!response.ok || !body.access_token) {
    throw new Error(
      body.error_message ||
        `Instagram token refresh failed with HTTP ${response.status}.`,
    );
  }

  const expiresAt = new Date(
    Date.now() + (body.expires_in ?? 5_184_000) * 1000,
  ).toISOString();

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("social_provider_connections")
    .update({
      access_token_ciphertext: encryptSocialSecret(body.access_token),
      expires_at: expiresAt,
      last_refreshed_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", connection.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ?? "Could not store refreshed Instagram credentials.",
    );
  }

  return data as ConnectionRow;
}

async function freshConnection(connection: ConnectionRow) {
  const expiry = connection.expires_at
    ? new Date(connection.expires_at).getTime()
    : 0;

  // Long-lived Instagram tokens last about 60 days. Refresh with a full week
  // of runway so scheduled publishing never depends on a last-minute refresh.
  if (expiry && expiry > Date.now() + 7 * 24 * 60 * 60_000) {
    return connection;
  }

  return refreshInstagramToken(connection);
}

export async function saveInstagramConnection(
  userId: string,
  token: IgTokenResponse,
) {
  if (!token.access_token) {
    throw new Error("Instagram did not return an access token.");
  }

  const profile = await getInstagramProfile(token.access_token);
  const providerUserId =
    profile.user_id || profile.id || String(token.user_id || "");

  if (!providerUserId) {
    throw new Error("Instagram did not return a professional account ID.");
  }

  const expiresAt = new Date(
    Date.now() + (token.expires_in ?? 5_184_000) * 1000,
  ).toISOString();

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("social_provider_connections")
    .upsert(
      {
        user_id: userId,
        platform: "instagram",
        provider_user_id: providerUserId,
        username: profile.username ?? null,
        display_name: profile.username ?? null,
        access_token_ciphertext: encryptSocialSecret(token.access_token),
        refresh_token_ciphertext: null,
        token_type: token.token_type ?? "bearer",
        scope: [
          "instagram_business_basic",
          "instagram_business_content_publish",
        ].join(" "),
        expires_at: expiresAt,
        connected_at: new Date().toISOString(),
        last_refreshed_at: new Date().toISOString(),
        last_error: null,
        metadata: {
          account_type: profile.account_type ?? null,
          graph_version: config().version,
          auth_path: "instagram_login",
        },
      },
      { onConflict: "user_id,platform" },
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ?? "Could not save Instagram connection.",
    );
  }

  return data as ConnectionRow;
}

export async function getInstagramConnectionForUser(userId: string) {
  if (!instagramOAuthConfigured()) return null;

  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("social_provider_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("platform", "instagram")
    .maybeSingle();

  if (!data) return null;

  try {
    return await freshConnection(data as ConnectionRow);
  } catch (error) {
    await supabase
      .from("social_provider_connections")
      .update({
        last_error:
          error instanceof Error
            ? error.message
            : "Instagram refresh failed.",
      })
      .eq("id", data.id);

    return data as ConnectionRow;
  }
}

async function getPublishingConnection() {
  const adminIds = await getAdminUserIds();
  const supabase = createAdminSupabaseClient();

  for (const userId of adminIds) {
    const { data } = await supabase
      .from("social_provider_connections")
      .select("*")
      .eq("user_id", userId)
      .eq("platform", "instagram")
      .maybeSingle();

    if (!data) continue;
    return freshConnection(data as ConnectionRow);
  }

  throw new Error(
    "No authorized Dusk Dashboard user has connected an Instagram account.",
  );
}

export async function disconnectInstagram(userId: string) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("social_provider_connections")
    .delete()
    .eq("user_id", userId)
    .eq("platform", "instagram");

  if (error) throw new Error(error.message);
}

export async function getInstagramProviderStatus(
  userId?: string,
): Promise<SocialProviderStatus> {
  const base: SocialProviderStatus = {
    platform: "instagram",
    label: "Instagram",
    configured: instagramOAuthConfigured(),
    live: true,
    connected: false,
    detail:
      "v25.2 live provider using Instagram Login for professional accounts.",
    capabilities: {
      text: false,
      photo: true,
      video: true,
      carousel: true,
      maxMedia: MAX_MEDIA,
      maxText: CAPTION_LIMIT,
      maxCaption: CAPTION_LIMIT,
      analytics: false,
    },
  };

  if (!base.configured) {
    return {
      ...base,
      detail:
        "Set INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, and SOCIAL_TOKEN_ENCRYPTION_KEY in Vercel.",
    };
  }

  if (!userId) {
    return {
      ...base,
      detail:
        "Instagram OAuth app is configured; no Dashboard user context supplied.",
    };
  }

  const connection = await getInstagramConnectionForUser(userId);

  if (!connection) {
    return {
      ...base,
      detail:
        "Instagram OAuth is ready. Connect a Business or Creator account from Social Ops.",
    };
  }

  try {
    const fresh = await freshConnection(connection);
    const accessToken = decryptSocialSecret(
      fresh.access_token_ciphertext,
    );
    const profile = await getInstagramProfile(accessToken);

    return {
      ...base,
      connected: true,
      account: profile.username ? `@${profile.username}` : null,
      target: profile.account_type ?? "Professional account",
      detail:
        "Instagram professional account connected. Feed photos, Reels, and carousels are live in v25.2.",
    };
  } catch (error) {
    return {
      ...base,
      account: connection.username
        ? `@${connection.username}`
        : null,
      error:
        error instanceof Error
          ? error.message
          : "Instagram token refresh failed.",
      detail: "Instagram is connected but needs reauthorization.",
    };
  }
}

function imageLooksSupported(asset: SocialMediaAsset) {
  if (asset.kind !== "image") return true;

  const mime = asset.mime_type?.toLowerCase();
  if (mime) return mime === "image/jpeg" || mime === "image/jpg";

  return /\.(jpe?g)(?:\?|#|$)/i.test(asset.url);
}

export function validateInstagramJob(job: SocialPublishJob) {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!instagramOAuthConfigured()) {
    errors.push("Instagram OAuth is not configured in Vercel.");
  }

  if (!job.media.length) {
    errors.push(
      "Instagram publishing requires at least one photo or video.",
    );
  }

  if (job.media.length > MAX_MEDIA) {
    errors.push(
      `Instagram carousels support at most ${MAX_MEDIA} media items.`,
    );
  }

  if (job.caption.length > CAPTION_LIMIT) {
    errors.push(
      `Instagram caption is ${job.caption.length} characters; maximum is ${CAPTION_LIMIT}.`,
    );
  }

  for (const asset of job.media) {
    if (asset.kind === "image" && !imageLooksSupported(asset)) {
      errors.push(
        `${asset.title} is not a JPEG. Instagram API feed-image publishing requires JPEG images.`,
      );
    }
  }

  if (
    job.media.length === 1 &&
    job.media[0]?.kind === "video"
  ) {
    warnings.push(
      "A single Instagram video will publish as a Reel and share to the feed.",
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function retryable(result: {
  status: number;
  transient: boolean;
  errorCode: number | null;
}) {
  return (
    result.transient ||
    result.status === 429 ||
    result.status >= 500 ||
    [1, 2, 4, 17, 32, 613].includes(result.errorCode ?? 0)
  );
}

async function createContainer(
  accessToken: string,
  igUserId: string,
  params: Record<string, string>,
) {
  const body = new URLSearchParams(params);
  const result = await igRequest<IgContainerResponse>(
    accessToken,
    `/${encodeURIComponent(igUserId)}/media`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );

  if (!result.ok || !result.body.id) {
    return {
      ok: false as const,
      retryable: retryable(result),
      retryAfterSeconds: result.retryAfter,
      error:
        result.error || "Instagram media-container creation failed.",
      providerResponse: {
        status: result.status,
        error_code: result.errorCode,
        error_subcode: result.errorSubcode,
      },
    };
  }

  return { ok: true as const, id: result.body.id };
}

async function containerStatus(
  accessToken: string,
  containerId: string,
) {
  return igRequest<IgContainerStatusResponse>(
    accessToken,
    `/${encodeURIComponent(
      containerId,
    )}?fields=status_code,status`,
  );
}

async function waitForContainers(
  accessToken: string,
  containerIds: string[],
  maxWaitMs = 45_000,
) {
  const started = Date.now();

  while (Date.now() - started < maxWaitMs) {
    let pending = false;

    for (const id of containerIds) {
      const result = await containerStatus(accessToken, id);

      if (!result.ok) {
        return {
          ready: false as const,
          terminal: !retryable(result),
          error:
            result.error ||
            `Could not read Instagram container ${id}.`,
        };
      }

      const status = result.body.status_code;

      if (status === "ERROR" || status === "EXPIRED") {
        return {
          ready: false as const,
          terminal: true,
          error:
            result.body.status ||
            `Instagram container ${id} ended in ${status}.`,
        };
      }

      if (status !== "FINISHED" && status !== "PUBLISHED") {
        pending = true;
      }
    }

    if (!pending) {
      return { ready: true as const };
    }

    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }

  return {
    ready: false as const,
    terminal: false,
    error: "Instagram is still processing the media container.",
  };
}

async function publishContainer(
  accessToken: string,
  igUserId: string,
  containerId: string,
) {
  const result = await igRequest<IgContainerResponse>(
    accessToken,
    `/${encodeURIComponent(igUserId)}/media_publish`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        creation_id: containerId,
      }),
    },
  );

  if (!result.ok || !result.body.id) {
    return {
      ok: false as const,
      retryable: retryable(result),
      retryAfterSeconds: result.retryAfter,
      error:
        result.error || "Instagram media publish failed.",
      providerResponse: {
        status: result.status,
        error_code: result.errorCode,
        error_subcode: result.errorSubcode,
      },
    };
  }

  return { ok: true as const, id: result.body.id };
}

async function publishedMediaDetails(
  accessToken: string,
  mediaId: string,
) {
  return igRequest<IgMediaResponse>(
    accessToken,
    `/${encodeURIComponent(
      mediaId,
    )}?fields=id,permalink,media_type,media_product_type`,
  );
}

type InstagramResumeState = {
  stage?: "single_processing" | "children_processing" | "parent_processing";
  containerId?: string;
  childIds?: string[];
};

function resumeState(job: SocialPublishJob): InstagramResumeState {
  const instagram = job.providerState?.instagram;

  if (!instagram || typeof instagram !== "object") return {};

  return instagram as InstagramResumeState;
}

function processingResult(
  state: InstagramResumeState,
  error: string,
): SocialPublishResult {
  return {
    ok: false,
    retryable: true,
    retryAfterSeconds: 60,
    error,
    providerResponse: {
      instagram: state,
    },
  };
}

export async function publishInstagram(
  job: SocialPublishJob,
): Promise<SocialPublishResult> {
  const validation = validateInstagramJob(job);

  if (!validation.valid) {
    return {
      ok: false,
      retryable: false,
      error: validation.errors.join(" "),
      providerResponse: { validation },
    };
  }

  let connection: ConnectionRow;

  try {
    connection = await getPublishingConnection();
    connection = await freshConnection(connection);
  } catch (error) {
    return {
      ok: false,
      retryable: false,
      error:
        error instanceof Error
          ? error.message
          : "Instagram account is not connected.",
    };
  }

  const accessToken = decryptSocialSecret(
    connection.access_token_ciphertext,
  );
  const igUserId = connection.provider_user_id;

  if (!igUserId) {
    return {
      ok: false,
      retryable: false,
      error: "Connected Instagram account has no professional account ID.",
    };
  }

  const state = resumeState(job);
  let publishableContainerId: string | null = null;

  if (state.stage === "single_processing" && state.containerId) {
    const ready = await waitForContainers(
      accessToken,
      [state.containerId],
    );

    if (!ready.ready) {
      if (ready.terminal) {
        return {
          ok: false,
          retryable: false,
          error: ready.error,
          providerResponse: { instagram: state },
        };
      }

      return processingResult(state, ready.error);
    }

    publishableContainerId = state.containerId;
  } else if (
    state.stage === "children_processing" &&
    state.childIds?.length
  ) {
    const ready = await waitForContainers(
      accessToken,
      state.childIds,
    );

    if (!ready.ready) {
      if (ready.terminal) {
        return {
          ok: false,
          retryable: false,
          error: ready.error,
          providerResponse: { instagram: state },
        };
      }

      return processingResult(state, ready.error);
    }

    const parent = await createContainer(accessToken, igUserId, {
      media_type: "CAROUSEL",
      children: state.childIds.join(","),
      caption: job.caption,
    });

    if (!parent.ok) {
      return {
        ok: false,
        retryable: parent.retryable,
        retryAfterSeconds: parent.retryAfterSeconds,
        error: parent.error,
        providerResponse: {
          ...parent.providerResponse,
          instagram: state,
        },
      };
    }

    const parentState: InstagramResumeState = {
      stage: "parent_processing",
      containerId: parent.id,
      childIds: state.childIds,
    };
    const parentReady = await waitForContainers(
      accessToken,
      [parent.id],
    );

    if (!parentReady.ready) {
      if (parentReady.terminal) {
        return {
          ok: false,
          retryable: false,
          error: parentReady.error,
          providerResponse: { instagram: parentState },
        };
      }

      return processingResult(parentState, parentReady.error);
    }

    publishableContainerId = parent.id;
  } else if (
    state.stage === "parent_processing" &&
    state.containerId
  ) {
    const ready = await waitForContainers(
      accessToken,
      [state.containerId],
    );

    if (!ready.ready) {
      if (ready.terminal) {
        return {
          ok: false,
          retryable: false,
          error: ready.error,
          providerResponse: { instagram: state },
        };
      }

      return processingResult(state, ready.error);
    }

    publishableContainerId = state.containerId;
  } else if (job.media.length === 1) {
    const asset = job.media[0];
    const params: Record<string, string> =
      asset.kind === "video"
        ? {
            media_type: "REELS",
            video_url: asset.url,
            caption: job.caption,
            share_to_feed: "true",
          }
        : {
            image_url: asset.url,
            caption: job.caption,
            ...(asset.alt_text
              ? { alt_text: asset.alt_text.slice(0, 1000) }
              : {}),
          };

    const container = await createContainer(
      accessToken,
      igUserId,
      params,
    );

    if (!container.ok) {
      return {
        ok: false,
        retryable: container.retryable,
        retryAfterSeconds: container.retryAfterSeconds,
        error: container.error,
        providerResponse: container.providerResponse,
      };
    }

    const singleState: InstagramResumeState = {
      stage: "single_processing",
      containerId: container.id,
    };
    const ready = await waitForContainers(
      accessToken,
      [container.id],
    );

    if (!ready.ready) {
      if (ready.terminal) {
        return {
          ok: false,
          retryable: false,
          error: ready.error,
          providerResponse: { instagram: singleState },
        };
      }

      return processingResult(singleState, ready.error);
    }

    publishableContainerId = container.id;
  } else {
    const childIds: string[] = [];

    for (const asset of job.media) {
      const params: Record<string, string> =
        asset.kind === "video"
          ? {
              media_type: "VIDEO",
              video_url: asset.url,
              is_carousel_item: "true",
            }
          : {
              image_url: asset.url,
              is_carousel_item: "true",
              ...(asset.alt_text
                ? { alt_text: asset.alt_text.slice(0, 1000) }
                : {}),
            };

      const child = await createContainer(
        accessToken,
        igUserId,
        params,
      );

      if (!child.ok) {
        const partialCarousel = childIds.length > 0;

        return {
          ok: false,
          retryable: partialCarousel ? false : child.retryable,
          retryAfterSeconds: partialCarousel
            ? null
            : child.retryAfterSeconds,
          error: partialCarousel
            ? `${child.error} Some carousel child containers were already created; use manual Retry so Dusk can safely rebuild the carousel from scratch.`
            : child.error,
          providerResponse: {
            ...child.providerResponse,
            instagram: {
              partial_child_ids: childIds,
            },
          },
        };
      }

      childIds.push(child.id);
    }

    const childState: InstagramResumeState = {
      stage: "children_processing",
      childIds,
    };
    const childrenReady = await waitForContainers(
      accessToken,
      childIds,
    );

    if (!childrenReady.ready) {
      if (childrenReady.terminal) {
        return {
          ok: false,
          retryable: false,
          error: childrenReady.error,
          providerResponse: { instagram: childState },
        };
      }

      return processingResult(childState, childrenReady.error);
    }

    const parent = await createContainer(accessToken, igUserId, {
      media_type: "CAROUSEL",
      children: childIds.join(","),
      caption: job.caption,
    });

    if (!parent.ok) {
      return {
        ok: false,
        retryable: parent.retryable,
        retryAfterSeconds: parent.retryAfterSeconds,
        error: parent.error,
        providerResponse: {
          ...parent.providerResponse,
          instagram: childState,
        },
      };
    }

    const parentState: InstagramResumeState = {
      stage: "parent_processing",
      containerId: parent.id,
      childIds,
    };
    const parentReady = await waitForContainers(
      accessToken,
      [parent.id],
    );

    if (!parentReady.ready) {
      if (parentReady.terminal) {
        return {
          ok: false,
          retryable: false,
          error: parentReady.error,
          providerResponse: { instagram: parentState },
        };
      }

      return processingResult(parentState, parentReady.error);
    }

    publishableContainerId = parent.id;
  }

  if (!publishableContainerId) {
    return {
      ok: false,
      retryable: true,
      retryAfterSeconds: 60,
      error: "Instagram container is not ready yet.",
    };
  }

  const published = await publishContainer(
    accessToken,
    igUserId,
    publishableContainerId,
  );

  if (!published.ok) {
    return {
      ok: false,
      retryable: published.retryable,
      retryAfterSeconds: published.retryAfterSeconds,
      error: published.error,
      providerResponse: {
        ...published.providerResponse,
        instagram: {
          stage: "parent_processing",
          containerId: publishableContainerId,
        },
      },
    };
  }

  const details = await publishedMediaDetails(
    accessToken,
    published.id,
  );
  const username = connection.username;

  return {
    ok: true,
    retryable: false,
    providerAccount: username ? `@${username}` : null,
    providerPostId: published.id,
    postUrl:
      details.body.permalink ||
      (username
        ? `https://www.instagram.com/${username}/`
        : null),
    publishedCaption: job.caption,
    publishedMedia: job.media,
    providerResponse: {
      instagram_media_id: published.id,
      container_id: publishableContainerId,
      permalink: details.body.permalink ?? null,
      media_type: details.body.media_type ?? null,
      media_product_type:
        details.body.media_product_type ?? null,
      validation_warnings: validation.warnings,
    },
  };
}
