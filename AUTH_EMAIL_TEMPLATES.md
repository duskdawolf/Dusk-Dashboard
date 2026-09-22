# Dusk Industries v24.4.1 — Cross-Browser Auth + Branded Email Templates

v24.4.1 fixes the PKCE problem that occurs when a recovery email is requested
in one browser/device and opened in another.

## Why the old link failed

The older recovery template sent Supabase's PKCE confirmation URL. PKCE stores a
temporary code verifier in the browser that initiated the reset.

That means:

```text
Private browser requests reset
        ↓
private browser owns verifier
        ↓
regular browser opens email
        ↓
verifier is missing
        ↓
PKCE code verifier not found
```

v24.4.1 changes the email action to a Supabase **TokenHash** link.

The email now opens:

```text
/auth/confirm?token_hash=...&type=recovery&next=/reset-password
```

Dusk verifies the one-time token on the server and writes the Supabase session
cookies there. No browser-local PKCE verifier is required.

---

# Install the Supabase email templates

Code deployment alone cannot change hosted Supabase Auth templates. Copy the
included templates into Supabase manually.

Open:

```text
Supabase → Authentication → Email Templates
```

## Reset Password / Recovery

Open the Supabase **Reset Password** template.

Subject suggestion:

```text
[Dusk Ops] Reset your Dashboard password
```

Replace the HTML body with:

```text
supabase/email-templates/recovery.html
```

This is the most important template for the cross-browser recovery fix.

## Magic Link

Subject:

```text
[Dusk Ops] Your Dashboard sign-in link
```

HTML:

```text
supabase/email-templates/magic-link.html
```

## Confirm Signup

Subject:

```text
[Dusk Ops] Confirm your account
```

HTML:

```text
supabase/email-templates/confirm-signup.html
```

## Invite User

Subject:

```text
[Dusk Ops] You've been cleared for Dusk Dashboard
```

HTML:

```text
supabase/email-templates/invite.html
```

## Change Email Address

Subject:

```text
[Dusk Ops] Confirm your email change
```

HTML:

```text
supabase/email-templates/change-email.html
```

Save each template after pasting it.

---

# Supabase URL configuration

Keep:

```text
Site URL:
https://duskdawolf.com
```

Add/keep these allowed redirect URLs:

```text
https://duskdawolf.com/auth/confirm
https://duskdawolf.com/auth/callback
https://duskdawolf.com/auth/recovery
https://duskdawolf.com/reset-password
https://duskdawolf.com/dashboard
```

The token-hash links use `.SiteURL`, so the production Site URL matters.

---

# Test cross-browser recovery

After v24.4.1 deploys and the Recovery email template is saved:

1. Open a Private/Incognito browser.
2. Open `https://duskdawolf.com/login`.
3. Enter your Dashboard email.
4. Click **Set / reset password**.
5. Close the private browser if you want.
6. Open the Resend-delivered recovery email in your normal browser or another device.
7. Click **SET NEW PASSWORD →**.
8. You should land on `/reset-password` with an authenticated recovery session.
9. Set the new password.
10. Dusk redirects to `/dashboard`.

That test specifically confirms the PKCE dependency is gone.

Old recovery emails sent before the template change can still use the legacy
`/auth/recovery` handler, but they remain subject to the PKCE same-browser rule.

---

# Email design

All supplied Auth emails now use the Dusk Industries visual system:

- deep navy website background
- Dusk aqua call-to-action
- Dusk pink accents
- rounded dark corporate panel
- spray-paint Dusk Industries logo
- "Restricted Corporate Infrastructure" language

Notification Ops emails sent through the Resend API were also restyled to use
the same header/logo/panel system.

No SQL migration is required for v24.4.1.
