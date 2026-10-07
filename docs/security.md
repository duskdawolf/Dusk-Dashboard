# Security assumptions and secrets

**Status: CURRENT — Alpha v31.2.** This page describes code and SQL boundaries; deployed configuration has not been inspected.

## Authentication and authorization

- [getDashboardUser / requireDashboardUser](../src/lib/auth.ts) validate the Supabase session with `auth.getUser()`. An email in `DUSK_ADMIN_EMAILS` (legacy singular alias supported here) is an admin; otherwise the profile must have `editor` or `admin` role. Dashboard layout authorization is not a replacement for authorization in an API handler.
- [requireAlpha7Admin](../src/lib/alpha7/auth.ts) and [requireDuskAdmin](../src/lib/next-stop/auth.ts) use separate gates. They check a signed-in user with email, but enforce `DUSK_ADMIN_EMAILS` only when the list is nonempty. With an empty list, any such authenticated user passes these gates. They do not reproduce the profile-role check or singular email alias.
- [service-role clients](../src/lib/supabase/server.ts) bypass RLS. Routes must enforce permissions and applicable record ownership themselves. Some Alpha7 context/mutation paths lack owner filtering; null-owned Deployment Ops records can be shared. This is not a proven multi-tenant access model.
- The base schema's `handle_new_user()` creates a `viewer` profile; [ensureProfileRow](../src/lib/profiles.ts) defaults missing profiles to `admin` when called by application paths. Do not assume every provisioning path applies the same role policy.
- [auth/confirm](../src/app/auth/confirm/route.ts) validates relative `next` destinations. [auth/callback](../src/app/auth/callback/route.ts) passes `next` to `new URL()` without equivalent validation, so absolute redirect destinations are accepted. This discrepancy remains in current code.

## Database and public/private separation

The [base schema](../supabase/schema.sql) enables RLS and supplies published/active public read policies; many operations tables have no direct browser write policy and are accessed through the server. Later SQL adds more tables and policies. Review the actual deployed policy set before relying on it.

Published-event RLS permits reading the row's columns, not only the fields the public UI maps into `EventItem`. Omitting a field from rendered HTML does not restrict direct public database queries. Keep private planning out of publicly readable rows or enforce a separate data-access boundary.

Personal `hotel_stays`, travel, registrations, budgets, packing and tasks are planning data. Public pages should select public facts explicitly instead of serializing a deployment summary or server context. See [public deployment pages](features/public-deployment-pages.md) for the current presentation and filtering differences.

Storage visibility and row visibility are separate. `public-media` and `next-stop-assets` are public buckets: hiding a database row does not revoke its object's URL. The public case-study media endpoint now checks both parent publication and `media.published`. Generated image validation can also fail while the image is still persisted publicly. Do not upload private reservations, credentials or internal planning to public storage or include them in public generated images. See [Media Library](features/media-library.md) and [Next Stop](features/next-stop.md).

The [v31.1 security hotfix](../supabase/ALPHA_V31_1_SECURITY_HOTFIX_RUN_THIS.sql) pins helper function `search_path`, changes read-only readiness helpers to `SECURITY INVOKER`, and removes direct execution from `PUBLIC`, `anon` and `authenticated`, granting it to `service_role`. It requires the v31 migration. It deliberately leaves the Auth trigger function unchanged. Its presence in Git does not prove those grants are live.

## AI and automation

Chaos proposes validated typed actions for explicit application. The two Copilot implementations have different approval/reauthentication behavior; do not assume the legacy password-grant mechanism protects every Alpha7 action. Prompts and model output are not authorization checks. Consult [Chaos Copilot](features/chaos-copilot.md) before changing application paths.

Integration endpoints use bearer secrets. Most Make endpoints require `MAKE_WEBHOOK_SECRET`; the unified tick prefers `AUTOMATION_TICK_SECRET` if set, then forwards that value to children that require the Make secret. Different values cause child authorization failures. Cron stores its bearer value in Supabase Vault; never commit a populated activation script or expose decrypted Vault values. See [automation](features/social-automation.md).

Provider connection/test and dispatch operations can contact external services and send messages. Do not treat them as harmless read-only smoke tests. Public quote submission also persists when server credentials are configured.

## Credential handling

| Configuration | Exposure / handling |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, publishable/anon key, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Intentionally browser-visible; they are not substitutes for server secrets or permission checks |
| `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Privileged server credential; never use a `NEXT_PUBLIC_` prefix |
| `OPENAI_API_KEY`, provider secrets, `RESEND_API_KEY`, `VAPID_PRIVATE_KEY`, automation bearer secrets | Server-only deployment/environment settings |
| `SOCIAL_TOKEN_ENCRYPTION_KEY` | Base64-encoded 32-byte server key used by [AES-256-GCM token encryption](../src/lib/social/crypto.ts); existing encrypted connections depend on it |
| Password reauthentication grants | Legacy flow stores a SHA-256 token hash, expiry and consumption state; raw grant is returned to the caller, not persisted as plaintext |

Use ignored local environment files for development and secure hosting/environment settings for deployment. Commit names and placeholder requirements only. Do not dump environments, log authorization headers, copy credentials into docs or use raw production records as fixtures. Inspect binding names and presence before requesting additional keys. Maintain TLS, artifact-integrity and package-verification checks.

## Convention Directory boundary

Alpha v31.2 directory administration uses central admin-role authorization; dashboard search/refresh requires an authorized operator. Internal tables/proposals/history have RLS and no anon/authenticated privileges. Service-only RPCs update normalized directory facts and create in-app notifications, never personal planning. The public edition view exposes a whitelist, with official hotels disabled by default; the featured-media view requires a published event and image. Source ingestion rejects private network addresses, unsafe URLs and cross-host redirects. Additional social sources are account-scoped. No AI or free-text web result can directly write an official edition. See [directory controls and verification](features/convention-directory.md).
