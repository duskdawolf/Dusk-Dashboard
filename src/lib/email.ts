type ResendNotification = {
  id: string;
  title: string;
  message: string;
  target_url?: string | null;
  action_label?: string | null;
  severity?: string | null;
  event_key?: string | null;
};

type ResendResult = {
  sent: number;
  failed: number;
  skipped: boolean;
  providerMessageId?: string | null;
  reason?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function absoluteTarget(targetUrl?: string | null) {
  if (!targetUrl) return null;
  if (/^https?:\/\//i.test(targetUrl)) return targetUrl;

  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://duskdawolf.com";

  return `${base}${targetUrl.startsWith("/") ? "" : "/"}${targetUrl}`;
}

export async function sendResendNotificationEmail(
  recipient: string | null | undefined,
  notification: ResendNotification,
): Promise<ResendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.RESEND_FROM_EMAIL ||
    "Dusk Industries <notifications@duskdawolf.com>";

  if (!apiKey) {
    return {
      sent: 0,
      failed: 0,
      skipped: true,
      reason: "RESEND_API_KEY is not configured.",
    };
  }

  if (!recipient) {
    return {
      sent: 0,
      failed: 0,
      skipped: true,
      reason: "The Dashboard user has no email address.",
    };
  }

  const targetUrl = absoluteTarget(notification.target_url);
  const title = escapeHtml(notification.title);
  const message = escapeHtml(notification.message).replaceAll("\n", "<br />");
  const actionLabel = escapeHtml(notification.action_label || "Open Dusk Ops");
  const severity = escapeHtml(
    (notification.severity || "info").toUpperCase(),
  );

  const html = `
<!doctype html>
<html>
  <body style="margin:0;background:#07101b;color:#eef5ff;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#07101b;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;border:1px solid #21324d;border-radius:26px;background:#0b1525;overflow:hidden;">
            <tr>
              <td style="padding:22px 28px;border-bottom:1px solid #1b2940;">
                <img src="https://duskdawolf.com/assets/logo-graffiti.png" width="240" alt="Dusk Industries" style="display:block;max-width:100%;height:auto;">
              </td>
            </tr>
            <tr>
              <td style="padding:30px 28px;">
                <div style="font-size:11px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:#61e8ff;">
                  DUSK INDUSTRIES™ NOTIFICATION OPS
                </div>
                <div style="margin-top:12px;display:inline-block;padding:6px 10px;border:1px solid #263854;border-radius:999px;background:#08111e;color:#aebbd0;font-size:10px;font-weight:900;letter-spacing:.12em;">
                  ${severity}
                </div>
                <h1 style="margin:18px 0 10px;font-size:32px;line-height:1.1;color:#ffffff;">
                  ${title}
                </h1>
                <div style="font-size:16px;line-height:1.65;color:#c3ccda;">
                  ${message}
                </div>
                ${
                  targetUrl
                    ? `<div style="margin-top:26px;">
                         <a href="${escapeHtml(targetUrl)}" style="display:inline-block;background:#61e8ff;color:#07101b;text-decoration:none;font-weight:900;padding:13px 19px;border-radius:13px;">
                           ${actionLabel} →
                         </a>
                       </div>`
                    : ""
                }
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;border-top:1px solid #1b2940;color:#65758c;font-size:11px;line-height:1.6;">
                Topic: ${escapeHtml(notification.event_key || "system.generic")}<br>
                Notification ID: ${escapeHtml(notification.id)}<br>
                Dusk Industries™ · Operational chaos, professionally documented.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject: `[Dusk Ops] ${notification.title}`,
        html,
        text: `${notification.title}\n\n${notification.message}${
          targetUrl ? `\n\n${notification.action_label || "Open Dusk Ops"}: ${targetUrl}` : ""
        }`,
      }),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        body?.message ||
        body?.error ||
        `Resend returned HTTP ${response.status}.`;

      return {
        sent: 0,
        failed: 1,
        skipped: false,
        reason: message,
      };
    }

    return {
      sent: 1,
      failed: 0,
      skipped: false,
      providerMessageId: body?.id ?? null,
      reason: null,
    };
  } catch (error) {
    return {
      sent: 0,
      failed: 1,
      skipped: false,
      reason:
        error instanceof Error ? error.message : "Unknown Resend request error.",
    };
  }
}
