# Dusk Industries v24.4 — Resend Email Setup

v24.4 changes only email delivery.

It uses Resend in two places:

1. **Supabase Auth email** — password recovery, magic links, invitations, etc.
2. **Dusk Notification Ops email** — the Email column in Notification Routing Preferences.

The API key is deliberately **not** stored in this repository.

---

## A. Verify duskdawolf.com in Resend

In the Resend dashboard:

1. Open **Domains**.
2. Add `duskdawolf.com`.
3. Add the DNS records Resend provides at your DNS host.
4. Wait until Resend shows the domain as verified.

Recommended addresses:

```text
Auth sender:
Dusk Industries <no-reply@duskdawolf.com>

Notification Ops sender:
Dusk Industries <notifications@duskdawolf.com>
```

Both can use the same verified domain.

---

## B. Route Supabase password-reset / magic-link emails through Resend

This is the important part for the Supabase password-recovery rate-limit problem.

In Supabase:

```text
Project → Authentication → SMTP Settings
```

Enable **Custom SMTP** and enter:

```text
Host:
smtp.resend.com

Port:
465

Username:
resend

Password:
<your Resend API key>

Sender email:
no-reply@duskdawolf.com

Sender name:
Dusk Industries
```

Save the SMTP configuration.

Supabase Auth continues generating the recovery/magic links. Resend only becomes
the mail transport.

After this is saved, use the existing Dusk Dashboard **Set / reset password**
button again. The email should be sent through Resend instead of Supabase's
limited default SMTP service.

Supabase may also expose Auth → Rate Limits. Custom SMTP allows you to choose a
more practical email rate limit for the project.

---

## C. Route Dusk Notification Ops email through Resend

In Vercel:

```text
Project → Settings → Environment Variables
```

Add:

```text
RESEND_API_KEY
```

Value:

```text
<your Resend API key>
```

Add:

```text
RESEND_FROM_EMAIL
```

Value:

```text
Dusk Industries <notifications@duskdawolf.com>
```

Apply these to **Production**.

Then redeploy the current Production deployment so the environment variables are
loaded.

Do not prefix the secret with `NEXT_PUBLIC_`.

Do not put the live key in `.env.example`, source control, screenshots, or Make.

---

## D. Test Notification Ops email

After redeployment:

1. Open `/dashboard/notifications`.
2. Open **Routing Preferences**.
3. Turn the global **Email** switch ON.
4. Enable Email for `Test notification`.
5. Go back to **Notification Inbox**.
6. Click **Send test notification**.

The notification delivery chips should show:

```text
email: sent
```

If Resend rejects it, the delivery record shows the provider error in the inbox.

---

## E. What changed in v24.4

Before:

```text
Dusk notification
   ↓
Email delivery row
   ↓
Make email queue (planned)
```

Now:

```text
Dusk notification
   ↓
Notification preferences
   ↓
Resend API
   ↓
Email
```

Telegram still uses the Make courier queue.

Supabase Auth uses Resend through SMTP and is independent of the Notification Ops
Resend API integration.

No database migration is required for v24.4.
