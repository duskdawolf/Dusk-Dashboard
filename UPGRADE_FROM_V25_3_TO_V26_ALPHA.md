# Upgrade Dusk Industries v25.3 → v26 Alpha

This is a major Alpha release. It rebuilds Convention Ops and adds Chaos
Copilot™.

## 1 — Update the code

Deploy the v26 Alpha package over v25.3.

Suggested commit:

```text
v26 alpha convention ops and chaos copilot
```

## 2 — Run the v26 Alpha migration

Supabase → SQL Editor:

```text
supabase/migrations/20260923_v26_alpha_chaos_ops.sql
```

Expected:

```text
Success. No rows returned
```

The migration adds:

- convention catalog
- Convention Ops ownership fields
- nested packing items
- nested prep tasks
- reusable loadout templates
- operator preferences
- Copilot threads/messages/actions
- one-use sensitive-action security grants

## 3 — Add OpenAI to Vercel

Required for Chaos Copilot:

```text
OPENAI_API_KEY
```

Optional:

```text
OPENAI_MODEL=gpt-6-astra
```

Keep the API key server-side. Do not expose it as `NEXT_PUBLIC_*`.

Redeploy after adding the variable.

## 4 — Open Convention Ops

Visit:

```text
/dashboard/con-prep
```

The page now automatically initializes the WikiFur convention catalog when the
catalog is empty.

The catalog is ordered using WikiFur's in-person convention attendance list.

Source precedence in the code is:

```text
official convention website/social
> WikiFur
> other/manual sources
```

Click:

```text
Sync WikiFur
```

to refresh WikiFur-backed records while preserving official overrides.

## 5 — Test one-click deployment

Choose a catalog convention with current dates and click:

```text
I'm Going
```

Confirm v26 creates:

```text
Event
Convention Ops record
Tactical Deployment Plan
packing loadout
prep tasks
```

For a catalog row whose current dates are not yet in the Alpha snapshot, the UI
asks for start/end dates before creating the deployment.

## 6 — Test nested packing

Open a deployment.

Use:

```text
+ sub-item
```

under a parent packing item.

Example:

```text
Donk Toss Kit
  → Prizes
  → Stickers
  → Signage
```

Child completion rolls up to the parent.

Prep tasks work the same way with:

```text
+ subtask
```

## 7 — Test Chaos Copilot

Inside a deployment try:

```text
Break Donk Toss Kit into a detailed checklist.
```

Chaos Copilot should return a proposed action.

Review the payload and press:

```text
Apply
```

The items should appear in the deployment checklist after refresh.

In Social Ops try:

```text
Review my recent posts and propose better platform-specific wording.
```

Copilot can propose Social Ops changes but does not silently apply them.

## 8 — Sensitive-action reauthentication

Sensitive Copilot proposals carry:

```text
reauth required
```

Approval first requests a fresh Supabase password check.

v26 creates a one-use 10-minute grant, stores only a SHA-256 hash of the grant
in Supabase, and consumes it when the sensitive action is approved.

After successful reauthentication, Copilot `publish_now` still does not call
providers directly. It validates each live provider job, marks the destinations
due immediately, and hands them to the existing Make Social Dispatcher.

## 9 — Existing social providers

v26 keeps the existing v25.3 provider stack:

```text
Telegram
X
Instagram
Bluesky
```

Your existing Make Social Dispatcher remains in place.

## 10 — Future Beta note

Alpha is still the private Dusk environment.

However, v26's new tables are already designed around explicit user ownership
where appropriate so Convention Ops / Chaos Copilot can later become per-profile
features when Beta introduces public furry registration.

## 11 — Footer

The footer should now show:

```text
Copyright 2026 Dusk Induskries.          v26 Alpha
```
