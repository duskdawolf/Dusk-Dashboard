import type {
  SocialMediaAsset,
  SocialProviderStatus,
  SocialPublishJob,
  SocialPublishResult,
} from "@/lib/social/types";

const TELEGRAM_API = "https://api.telegram.org";
const MAX_TEXT = 4096;
const MAX_CAPTION = 1024;
const MAX_MEDIA = 10;

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
  parameters?: {
    retry_after?: number;
  };
};

type TelegramMessage = {
  message_id: number;
  date: number;
  text?: string;
  caption?: string;
  chat?: {
    id: number;
    title?: string;
    username?: string;
    type?: string;
  };
};

type TelegramUser = {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
};

function config() {
  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN?.trim() || "",
    chatId: process.env.TELEGRAM_CHAT_ID?.trim() || "",
    publicUsername:
      process.env.TELEGRAM_PUBLIC_CHAT_USERNAME?.trim().replace(/^@/, "") || "",
    messageThreadId:
      process.env.TELEGRAM_MESSAGE_THREAD_ID?.trim() || "",
  };
}

export function telegramConfigured() {
  const cfg = config();
  return Boolean(cfg.botToken && cfg.chatId);
}

async function telegramRequest<T>(
  method: string,
  body?: Record<string, unknown>,
): Promise<TelegramApiResponse<T>> {
  const { botToken } = config();

  if (!botToken) {
    return {
      ok: false,
      error_code: 500,
      description: "TELEGRAM_BOT_TOKEN is not configured.",
    };
  }

  try {
    const response = await fetch(
      `${TELEGRAM_API}/bot${botToken}/${method}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
      },
    );

    const data = (await response.json()) as TelegramApiResponse<T>;

    if (!response.ok && data.ok) {
      return {
        ok: false,
        error_code: response.status,
        description: `Telegram returned HTTP ${response.status}.`,
      };
    }

    return data;
  } catch (error) {
    return {
      ok: false,
      error_code: 599,
      description:
        error instanceof Error ? error.message : "Telegram network error.",
    };
  }
}

function threadField() {
  const { messageThreadId } = config();
  if (!messageThreadId) return {};

  const parsed = Number(messageThreadId);
  return Number.isFinite(parsed)
    ? { message_thread_id: parsed }
    : {};
}

function publicPostUrl(messageId: number) {
  const { chatId, publicUsername } = config();
  const username =
    publicUsername || (chatId.startsWith("@") ? chatId.slice(1) : "");

  return username ? `https://t.me/${username}/${messageId}` : null;
}

function mediaDescriptor(asset: SocialMediaAsset, caption?: string) {
  return {
    type: asset.kind === "video" ? "video" : "photo",
    media: asset.url,
    ...(caption ? { caption } : {}),
  };
}

function retryableFromResponse(response: TelegramApiResponse<unknown>) {
  const code = response.error_code ?? 0;
  return code === 429 || code >= 500 || code === 599;
}

function resultFromFailure(
  response: TelegramApiResponse<unknown>,
): SocialPublishResult {
  return {
    ok: false,
    retryable: retryableFromResponse(response),
    retryAfterSeconds: response.parameters?.retry_after ?? null,
    error:
      response.description ||
      `Telegram API error ${response.error_code ?? "unknown"}.`,
    providerResponse: {
      error_code: response.error_code ?? null,
      description: response.description ?? null,
      retry_after: response.parameters?.retry_after ?? null,
    },
  };
}

async function sendText(text: string) {
  const { chatId } = config();
  return telegramRequest<TelegramMessage>("sendMessage", {
    chat_id: chatId,
    text,
    ...threadField(),
  });
}

async function sendSingleMedia(
  asset: SocialMediaAsset,
  caption: string,
) {
  const { chatId } = config();
  const method = asset.kind === "video" ? "sendVideo" : "sendPhoto";
  const mediaField = asset.kind === "video" ? "video" : "photo";

  return telegramRequest<TelegramMessage>(method, {
    chat_id: chatId,
    [mediaField]: asset.url,
    ...(caption ? { caption } : {}),
    ...threadField(),
  });
}

async function sendAlbum(
  media: SocialMediaAsset[],
  caption: string,
) {
  const { chatId } = config();
  return telegramRequest<TelegramMessage[]>("sendMediaGroup", {
    chat_id: chatId,
    media: media.map((asset, index) =>
      mediaDescriptor(asset, index === 0 ? caption : undefined),
    ),
    ...threadField(),
  });
}

export function validateTelegramJob(job: SocialPublishJob) {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!telegramConfigured()) {
    errors.push(
      "Telegram provider is not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.",
    );
  }

  if (job.caption.length > MAX_TEXT) {
    errors.push(
      `Telegram text is ${job.caption.length} characters; the current text limit is ${MAX_TEXT}.`,
    );
  }

  if (job.media.length > MAX_MEDIA) {
    errors.push(
      `Telegram albums support at most ${MAX_MEDIA} media items in this publisher.`,
    );
  }

  if (job.media.length > 0 && job.caption.length > MAX_CAPTION) {
    warnings.push(
      `Caption exceeds ${MAX_CAPTION} characters, so Dusk will publish the media first and the full caption as a separate Telegram message.`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export async function getTelegramProviderStatus(): Promise<SocialProviderStatus> {
  const cfg = config();

  const base: SocialProviderStatus = {
    platform: "telegram",
    label: "Telegram",
    configured: Boolean(cfg.botToken && cfg.chatId),
    live: true,
    connected: false,
    target: cfg.chatId || null,
    detail:
      "Live Telegram provider. Text, single media, and 2–10 item photo/video albums are supported.",
    capabilities: {
      text: true,
      photo: true,
      video: true,
      carousel: true,
      maxMedia: MAX_MEDIA,
      maxText: MAX_TEXT,
      maxCaption: MAX_CAPTION,
      analytics: false,
    },
  };

  if (!base.configured) {
    return {
      ...base,
      detail:
        "Not configured. Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Vercel.",
    };
  }

  const [me, chat] = await Promise.all([
    telegramRequest<TelegramUser>("getMe"),
    telegramRequest<any>("getChat", { chat_id: cfg.chatId }),
  ]);

  if (!me.ok) {
    return {
      ...base,
      error: me.description ?? "Telegram getMe failed.",
      detail: "Bot token could not be validated.",
    };
  }

  if (!chat.ok) {
    return {
      ...base,
      account: me.result?.username
        ? `@${me.result.username}`
        : me.result?.first_name ?? "Telegram bot",
      error: chat.description ?? "Telegram getChat failed.",
      detail:
        "Bot token is valid, but the configured target chat could not be read. Check TELEGRAM_CHAT_ID and bot membership/admin access.",
    };
  }

  return {
    ...base,
    connected: true,
    account: me.result?.username
      ? `@${me.result.username}`
      : me.result?.first_name ?? "Telegram bot",
    target:
      chat.result?.username
        ? `@${chat.result.username}`
        : chat.result?.title ?? String(chat.result?.id ?? cfg.chatId),
    detail:
      "Telegram bot and target chat both validated. Scheduled Telegram posts are live.",
  };
}

export async function publishTelegram(
  job: SocialPublishJob,
): Promise<SocialPublishResult> {
  const validation = validateTelegramJob(job);

  if (!validation.valid) {
    return {
      ok: false,
      retryable: false,
      error: validation.errors.join(" "),
      providerResponse: { validation },
    };
  }

  const provider = await getTelegramProviderStatus();

  if (!provider.connected) {
    return {
      ok: false,
      retryable: false,
      error: provider.error || provider.detail,
      providerResponse: { provider },
    };
  }

  const caption = job.caption.trim();
  const captionFitsMedia = caption.length <= MAX_CAPTION;
  const messageIds: number[] = [];
  const responses: unknown[] = [];

  if (job.media.length === 0) {
    const response = await sendText(caption);
    responses.push(response);

    if (!response.ok || !response.result) {
      return resultFromFailure(response);
    }

    messageIds.push(response.result.message_id);
  } else if (job.media.length === 1) {
    const response = await sendSingleMedia(
      job.media[0],
      captionFitsMedia ? caption : "",
    );
    responses.push(response);

    if (!response.ok || !response.result) {
      return resultFromFailure(response);
    }

    messageIds.push(response.result.message_id);

    if (caption && !captionFitsMedia) {
      const textResponse = await sendText(caption);
      responses.push(textResponse);

      if (!textResponse.ok || !textResponse.result) {
        return resultFromFailure(textResponse);
      }

      messageIds.push(textResponse.result.message_id);
    }
  } else {
    const response = await sendAlbum(
      job.media,
      captionFitsMedia ? caption : "",
    );
    responses.push(response);

    if (!response.ok || !response.result) {
      return resultFromFailure(response);
    }

    messageIds.push(
      ...response.result.map((message) => message.message_id),
    );

    if (caption && !captionFitsMedia) {
      const textResponse = await sendText(caption);
      responses.push(textResponse);

      if (!textResponse.ok || !textResponse.result) {
        return resultFromFailure(textResponse);
      }

      messageIds.push(textResponse.result.message_id);
    }
  }

  const firstMessageId = messageIds[0] ?? null;

  return {
    ok: true,
    retryable: false,
    providerAccount: provider.account ?? null,
    providerPostId: firstMessageId ? String(firstMessageId) : null,
    postUrl: firstMessageId ? publicPostUrl(firstMessageId) : null,
    publishedCaption: caption,
    publishedMedia: job.media,
    providerResponse: {
      messageIds,
      responses,
      warnings: validation.warnings,
      target: provider.target ?? null,
    },
  };
}
