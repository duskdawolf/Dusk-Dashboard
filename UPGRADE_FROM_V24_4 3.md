# Upgrade Dusk Industries v24.4 → v24.4.1

v24.4.1 contains two related changes:

1. Cross-browser/device Supabase Auth confirmation using TokenHash.
2. Branded Dusk Industries Auth + Notification Ops email design.

## 1 — Update code

Replace/update v24.4 with this package.

Suggested commit:

```text
v24.4.1 cross-browser auth recovery and branded email templates
```

Push `main` and let Vercel deploy.

## 2 — SQL

**No SQL migration is required.**

## 3 — Install the Supabase templates

This step is required.

Follow:

```text
AUTH_EMAIL_TEMPLATES.md
```

At minimum you must replace Supabase's **Reset Password** template with:

```text
supabase/email-templates/recovery.html
```

Without that template change, Supabase will keep sending the older PKCE-style
confirmation URL.

## 4 — Confirm Supabase URL settings

Production Site URL:

```text
https://duskdawolf.com
```

Allow:

```text
https://duskdawolf.com/auth/confirm
https://duskdawolf.com/auth/callback
https://duskdawolf.com/auth/recovery
https://duskdawolf.com/reset-password
https://duskdawolf.com/dashboard
```

## 5 — Cross-browser test

Request a reset in Private Browsing, then open the new email in your regular
browser.

The new email should use `/auth/confirm?...token_hash=...` and should land on
`/reset-password` without a PKCE verifier error.

## 6 — Resend

Your v24.4 Resend SMTP/API configuration stays exactly the same.

No Resend key belongs in source control.
