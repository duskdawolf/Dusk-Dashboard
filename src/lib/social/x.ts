import crypto from "crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { getAdminUserIds } from "@/lib/notifications";
import { decryptSocialSecret, encryptSocialSecret } from "@/lib/social/crypto";
import type { SocialMediaAsset, SocialProviderStatus, SocialPublishJob, SocialPublishResult } from "@/lib/social/types";

const X_API = "https://api.x.com";
const X_AUTHORIZE = "https://x.com/i/oauth2/authorize";
const X_TOKEN = "https://api.x.com/2/oauth2/token";
const DEFAULT_MAX_TEXT = 280;
const MAX_IMAGES = 4;
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const GIF_MAX_BYTES = 15 * 1024 * 1024;
const VIDEO_CHUNK_BYTES = 4 * 1024 * 1024;

type ConnectionRow = {
  id: string;
  user_id: string;
  platform: "twitter";
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

type XTokenResponse = {
  token_type?: string;
  expires_in?: number;
  access_token?: string;
  scope?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
};

type XMeResponse = { data?: { id: string; name: string; username: string }; errors?: Array<{ title?: string; detail?: string }> };
type XProcessingInfo = { state?: string; check_after_secs?: number; progress_percent?: number; error?: { code?: number; name?: string; message?: string } };
type XMediaResponse = { data?: { id?: string; media_key?: string; processing_info?: XProcessingInfo }; errors?: Array<{ title?: string; detail?: string }>; error?: string; detail?: string };
type XPostResponse = { data?: { id: string; text: string; edit_history_post_ids?: string[] }; errors?: Array<{ title?: string; detail?: string }>; title?: string; detail?: string; status?: number };

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://duskdawolf.com";
}
export function xRedirectUri() { return `${siteUrl()}/api/admin/social/x/callback`; }

function xConfig() {
  return {
    clientId: process.env.X_CLIENT_ID?.trim() || "",
    clientSecret: process.env.X_CLIENT_SECRET?.trim() || "",
    maxText: Number(process.env.X_MAX_POST_CHARS || DEFAULT_MAX_TEXT),
    maxMediaMb: Number(process.env.X_MAX_MEDIA_MB || 50),
  };
}

export function xOAuthConfigured() {
  const cfg = xConfig();
  return Boolean(cfg.clientId && cfg.clientSecret && process.env.SOCIAL_TOKEN_ENCRYPTION_KEY);
}

function basicAuth() {
  const cfg = xConfig();
  return `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`, "utf8").toString("base64")}`;
}

async function tokenRequest(params: URLSearchParams) {
  const response = await fetch(X_TOKEN, {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as XTokenResponse;
  return { ok: response.ok && Boolean(body.access_token), status: response.status, body };
}

export function createXAuthorizationRequest() {
  const cfg = xConfig();
  if (!xOAuthConfigured()) throw new Error("X OAuth is not configured. Set X_CLIENT_ID, X_CLIENT_SECRET, and SOCIAL_TOKEN_ENCRYPTION_KEY.");
  const state = crypto.randomBytes(32).toString("base64url");
  const verifier = crypto.randomBytes(48).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    redirect_uri: xRedirectUri(),
    scope: ["tweet.read", "tweet.write", "users.read", "media.write", "offline.access"].join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return { url: `${X_AUTHORIZE}?${params.toString()}`, state, verifier };
}

export async function exchangeXAuthorizationCode(code: string, verifier: string) {
  const result = await tokenRequest(new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: xRedirectUri(),
    code_verifier: verifier,
  }));
  if (!result.ok) throw new Error(result.body.error_description || result.body.error || `X token exchange failed with HTTP ${result.status}.`);
  return result.body;
}

async function xRequest<T>(accessToken: string, path: string, init: RequestInit = {}) {
  try {
    const response = await fetch(`${X_API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${accessToken}`, ...(init.headers ?? {}) },
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as T & { title?: string; detail?: string; errors?: Array<{ title?: string; detail?: string }> };
    const firstError = body.errors?.[0];
    return {
      ok: response.ok,
      status: response.status,
      body,
      error: firstError?.detail || firstError?.title || body.detail || body.title || (!response.ok ? `X returned HTTP ${response.status}.` : null),
      retryAfter: Number(response.headers.get("retry-after") || 0) || null,
    };
  } catch (error) {
    return { ok: false, status: 599, body: {} as T, error: error instanceof Error ? error.message : "X network error.", retryAfter: null };
  }
}

async function refreshXTokens(connection: ConnectionRow) {
  if (!connection.refresh_token_ciphertext) throw new Error("X connection has no refresh token. Reconnect X with offline.access.");
  const refreshToken = decryptSocialSecret(connection.refresh_token_ciphertext);
  const result = await tokenRequest(new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }));
  if (!result.ok || !result.body.access_token) throw new Error(result.body.error_description || result.body.error || `X refresh failed with HTTP ${result.status}.`);

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.from("social_provider_connections").update({
    access_token_ciphertext: encryptSocialSecret(result.body.access_token),
    refresh_token_ciphertext: result.body.refresh_token ? encryptSocialSecret(result.body.refresh_token) : connection.refresh_token_ciphertext,
    token_type: result.body.token_type ?? connection.token_type,
    scope: result.body.scope ?? connection.scope,
    expires_at: new Date(Date.now() + (result.body.expires_in ?? 7200) * 1000).toISOString(),
    last_refreshed_at: new Date().toISOString(),
    last_error: null,
  }).eq("id", connection.id).select("*").single();
  if (error || !data) throw new Error(error?.message ?? "Could not store refreshed X credentials.");
  return data as ConnectionRow;
}

async function freshConnection(connection: ConnectionRow) {
  const expiry = connection.expires_at ? new Date(connection.expires_at).getTime() : 0;
  if (expiry && expiry > Date.now() + 5 * 60_000) return connection;
  return refreshXTokens(connection);
}

export async function saveXConnection(userId: string, tokens: XTokenResponse) {
  if (!tokens.access_token) throw new Error("X did not return an access token.");
  const me = await xRequest<XMeResponse>(tokens.access_token, "/2/users/me?user.fields=id,name,username");
  if (!me.ok || !me.body.data) throw new Error(me.error || "Could not identify the connected X account.");
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.from("social_provider_connections").upsert({
    user_id: userId,
    platform: "twitter",
    provider_user_id: me.body.data.id,
    username: me.body.data.username,
    display_name: me.body.data.name,
    access_token_ciphertext: encryptSocialSecret(tokens.access_token),
    refresh_token_ciphertext: tokens.refresh_token ? encryptSocialSecret(tokens.refresh_token) : null,
    token_type: tokens.token_type ?? "bearer",
    scope: tokens.scope ?? null,
    expires_at: new Date(Date.now() + (tokens.expires_in ?? 7200) * 1000).toISOString(),
    connected_at: new Date().toISOString(),
    last_refreshed_at: new Date().toISOString(),
    last_error: null,
    metadata: { redirect_uri: xRedirectUri() },
  }, { onConflict: "user_id,platform" }).select("*").single();
  if (error || !data) throw new Error(error?.message ?? "Could not save X connection.");
  return data as ConnectionRow;
}

export async function getXConnectionForUser(userId: string) {
  if (!xOAuthConfigured()) return null;
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase.from("social_provider_connections").select("*").eq("user_id", userId).eq("platform", "twitter").maybeSingle();
  if (!data) return null;
  try { return await freshConnection(data as ConnectionRow); }
  catch (error) {
    await supabase.from("social_provider_connections").update({ last_error: error instanceof Error ? error.message : "X refresh failed." }).eq("id", data.id);
    return data as ConnectionRow;
  }
}

async function getPublishingConnection() {
  const adminIds = await getAdminUserIds();
  const supabase = createAdminSupabaseClient();
  for (const userId of adminIds) {
    const { data } = await supabase.from("social_provider_connections").select("*").eq("user_id", userId).eq("platform", "twitter").maybeSingle();
    if (data) return freshConnection(data as ConnectionRow);
  }
  throw new Error("No authorized Dusk Dashboard user has connected an X account.");
}

export async function disconnectX(userId: string) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("social_provider_connections").delete().eq("user_id", userId).eq("platform", "twitter");
  if (error) throw new Error(error.message);
}

export async function getXProviderStatus(userId?: string): Promise<SocialProviderStatus> {
  const cfg = xConfig();
  const base: SocialProviderStatus = {
    platform: "twitter",
    label: "X",
    configured: xOAuthConfigured(),
    live: true,
    connected: false,
    detail: "v25.1 live provider using X API v2 OAuth 2.0 PKCE.",
    capabilities: { text: true, photo: true, video: true, carousel: true, maxMedia: 4, maxText: cfg.maxText || DEFAULT_MAX_TEXT, maxCaption: cfg.maxText || DEFAULT_MAX_TEXT, analytics: false },
  };
  if (!base.configured) return { ...base, detail: "Set X_CLIENT_ID, X_CLIENT_SECRET, and SOCIAL_TOKEN_ENCRYPTION_KEY in Vercel." };
  if (!userId) return { ...base, detail: "X OAuth app is configured; connect an authorized Dashboard account." };
  const connection = await getXConnectionForUser(userId);
  if (!connection) return { ...base, detail: "X OAuth app is ready. Connect your X account from Social Ops." };
  let fresh: ConnectionRow;
  try { fresh = await freshConnection(connection); }
  catch (error) {
    return { ...base, account: connection.username ? `@${connection.username}` : connection.display_name, error: error instanceof Error ? error.message : "X token refresh failed.", detail: "X is connected but needs reauthorization." };
  }
  const accessToken = decryptSocialSecret(fresh.access_token_ciphertext);
  const me = await xRequest<XMeResponse>(accessToken, "/2/users/me?user.fields=id,name,username");
  if (!me.ok || !me.body.data) return { ...base, account: fresh.username ? `@${fresh.username}` : fresh.display_name, error: me.error, detail: "X credentials exist but the account check failed." };
  return { ...base, connected: true, account: `@${me.body.data.username}`, target: me.body.data.name, detail: "X account connected. Scheduled X posts are live in v25.1." };
}

export function validateXJob(job: SocialPublishJob) {
  const cfg = xConfig();
  const errors: string[] = [];
  const warnings: string[] = [];
  const maxText = cfg.maxText || DEFAULT_MAX_TEXT;
  if (!xOAuthConfigured()) errors.push("X OAuth is not configured in Vercel.");
  if (job.caption.length > maxText) errors.push(`X caption is ${job.caption.length} characters; Dusk's configured X limit is ${maxText}.`);
  const videos = job.media.filter((item) => item.kind === "video");
  const gifs = job.media.filter((item) => item.kind === "image" && item.mime_type?.toLowerCase() === "image/gif");
  const stillImages = job.media.filter((item) => item.kind === "image" && !gifs.includes(item));
  if (videos.length > 1) errors.push("X Posts can attach at most one video.");
  if (gifs.length > 1) errors.push("X Posts can attach at most one animated GIF.");
  if ((videos.length || gifs.length) && job.media.length > 1) errors.push("X does not allow a video or animated GIF to be mixed with other media in one Post.");
  if (stillImages.length > MAX_IMAGES) errors.push(`X supports at most ${MAX_IMAGES} photos per Post.`);
  return { valid: errors.length === 0, errors, warnings };
}

async function fetchMediaAsset(asset: SocialMediaAsset) {
  const response = await fetch(asset.url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not download ${asset.title}: HTTP ${response.status}.`);
  const capBytes = Math.max(xConfig().maxMediaMb || 50, 1) * 1024 * 1024;
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared && declared > capBytes) throw new Error(`${asset.title} exceeds Dusk's X serverless upload cap of ${xConfig().maxMediaMb || 50} MB.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > capBytes) throw new Error(`${asset.title} exceeds Dusk's X serverless upload cap of ${xConfig().maxMediaMb || 50} MB.`);
  const contentType = asset.mime_type || response.headers.get("content-type") || (asset.kind === "video" ? "video/mp4" : "image/jpeg");
  return { bytes, contentType };
}

function mediaCategory(asset: SocialMediaAsset, contentType: string) {
  if (asset.kind === "video") return "tweet_video";
  if (contentType.toLowerCase() === "image/gif") return "tweet_gif";
  return "tweet_image";
}

async function simpleUpload(accessToken: string, asset: SocialMediaAsset, bytes: Buffer, contentType: string) {
  const limit = contentType.toLowerCase() === "image/gif" ? GIF_MAX_BYTES : IMAGE_MAX_BYTES;
  if (bytes.length > limit) throw new Error(`${asset.title} is too large for X simple upload (${Math.ceil(bytes.length / 1024 / 1024)} MB).`);
  const response = await xRequest<XMediaResponse>(accessToken, "/2/media/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media: bytes.toString("base64"), media_category: mediaCategory(asset, contentType) }),
  });
  if (!response.ok || !response.body.data?.id) throw new Error(response.error || `X media upload failed for ${asset.title}.`);
  return response.body.data.id;
}

async function waitForProcessing(accessToken: string, mediaId: string, processingInfo?: XProcessingInfo) {
  let info = processingInfo;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (!info || info.state === "succeeded") return;
    if (info.state === "failed") throw new Error(info.error?.message || "X media processing failed.");
    const waitSeconds = Math.min(Math.max(Number(info.check_after_secs || 2), 1), 10);
    await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
    const status = await xRequest<XMediaResponse>(accessToken, `/2/media/upload?media_id=${encodeURIComponent(mediaId)}&command=STATUS`);
    if (!status.ok) throw new Error(status.error || "Could not check X media processing status.");
    info = status.body.data?.processing_info;
  }
  throw new Error("X media processing timed out.");
}

async function chunkedUpload(accessToken: string, asset: SocialMediaAsset, bytes: Buffer, contentType: string) {
  const initialized = await xRequest<XMediaResponse>(accessToken, "/2/media/upload/initialize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ total_bytes: bytes.length, media_type: contentType, media_category: mediaCategory(asset, contentType) }),
  });
  const mediaId = initialized.body.data?.id;
  if (!initialized.ok || !mediaId) throw new Error(initialized.error || `Could not initialize ${asset.title} upload.`);
  let segment = 0;
  for (let offset = 0; offset < bytes.length; offset += VIDEO_CHUNK_BYTES) {
    const chunk = bytes.subarray(offset, Math.min(offset + VIDEO_CHUNK_BYTES, bytes.length));
    const appended = await xRequest<Record<string, unknown>>(accessToken, `/2/media/upload/${mediaId}/append`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media: chunk.toString("base64"), segment_index: segment }),
    });
    if (!appended.ok) throw new Error(appended.error || `X media segment ${segment} failed for ${asset.title}.`);
    segment += 1;
  }
  const finalized = await xRequest<XMediaResponse>(accessToken, `/2/media/upload/${mediaId}/finalize`, { method: "POST" });
  if (!finalized.ok) throw new Error(finalized.error || `Could not finalize ${asset.title}.`);
  await waitForProcessing(accessToken, mediaId, finalized.body.data?.processing_info);
  return mediaId;
}

async function uploadXMedia(accessToken: string, asset: SocialMediaAsset) {
  const { bytes, contentType } = await fetchMediaAsset(asset);
  const isGif = contentType.toLowerCase() === "image/gif";
  return asset.kind === "video" || isGif ? chunkedUpload(accessToken, asset, bytes, contentType) : simpleUpload(accessToken, asset, bytes, contentType);
}

function retryableStatus(status: number) { return status === 429 || status >= 500 || status === 599; }

export async function publishX(job: SocialPublishJob): Promise<SocialPublishResult> {
  const validation = validateXJob(job);
  if (!validation.valid) return { ok: false, retryable: false, error: validation.errors.join(" "), providerResponse: { validation } };
  let connection: ConnectionRow;
  try { connection = await getPublishingConnection(); }
  catch (error) { return { ok: false, retryable: false, error: error instanceof Error ? error.message : "X account is not connected." }; }
  let accessToken: string;
  try {
    connection = await freshConnection(connection);
    accessToken = decryptSocialSecret(connection.access_token_ciphertext);
  } catch (error) {
    return { ok: false, retryable: false, error: error instanceof Error ? error.message : "Could not refresh X authorization." };
  }
  try {
    const mediaIds: string[] = [];
    for (const asset of job.media) mediaIds.push(await uploadXMedia(accessToken, asset));
    const response = await xRequest<XPostResponse>(accessToken, "/2/tweets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: job.caption, ...(mediaIds.length ? { media: { media_ids: mediaIds } } : {}) }),
    });
    if (!response.ok || !response.body.data?.id) {
      return { ok: false, retryable: retryableStatus(response.status), retryAfterSeconds: response.retryAfter, error: response.error || "X rejected the Post.", providerResponse: response.body as Record<string, unknown> };
    }
    const postId = response.body.data.id;
    const username = connection.username;
    return {
      ok: true,
      retryable: false,
      providerAccount: username ? `@${username}` : connection.display_name,
      providerPostId: postId,
      postUrl: username ? `https://x.com/${username}/status/${postId}` : `https://x.com/i/web/status/${postId}`,
      publishedCaption: job.caption,
      publishedMedia: job.media,
      providerResponse: { ...response.body, media_ids: mediaIds, validation_warnings: validation.warnings },
    };
  } catch (error) {
    return { ok: false, retryable: false, error: error instanceof Error ? error.message : "X publishing failed." };
  }
}
