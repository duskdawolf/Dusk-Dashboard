# Upgrade Dusk Industries v24.4.1 → v24.4.2

v24.4.2 is the final v24 release.

It adds:

1. Branded Supabase **Reauthentication** email template.
2. `/dashboard/account` for secure email/password changes using reauthentication.
3. A global footer on every page:
   - `Copyright 2026 Dusk Induskries.`
   - `v24.4.2`

## 1 — Update the repository

Replace/update v24.4.1 with v24.4.2.

Suggested commit:

```text
v24.4.2 reauthentication and global version footer
```

Push `main` and let Vercel deploy.

## 2 — SQL

**No SQL migration is required.**

## 3 — Install the Reauthentication template

Open:

```text
Supabase → Authentication → Email Templates → Reauthentication
```

Subject:

```text
[Dusk Ops] {{ .Token }} is your verification code
```

Replace the HTML body with:

```text
supabase/email-templates/reauthentication.html
```

Save.

## 4 — Test Account Security

Open:

```text
/dashboard/account
```

### Password

1. Enter a new password.
2. Click **Reauthenticate & change password**.
3. Resend/Supabase sends the branded Reauthentication email.
4. Enter the OTP from the email.
5. Click **Verify & apply change**.

### Email

1. Enter the new address.
2. Click **Reauthenticate & change email**.
3. Enter the reauthentication OTP.
4. Dusk submits the email update with the nonce.
5. Complete Supabase's secure email-change confirmation email(s).

## 5 — Secure Password Change setting

In Supabase Authentication settings, enable **Secure password change** if you
want Supabase itself to enforce reauthentication for password changes outside
the Dusk UI as well.

The Dusk Account Security screen explicitly performs reauthentication regardless,
which keeps the Dusk UI consistent for both email and password changes.

## 6 — Footer

Every public and Dashboard route inherits the global footer automatically:

```text
Copyright 2026 Dusk Induskries.                     v24.4.2
```

No individual page edits are required.
