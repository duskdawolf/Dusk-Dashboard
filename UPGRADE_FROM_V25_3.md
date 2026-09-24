# Upgrade Dusk Industries v25.3 → v26.0 Alpha

v26 Alpha is a large Convention Operations + Chaos Copilot™ migration.

## 1 — Deploy the code

Replace/update v25.3 with the v26 Alpha package.

Suggested commit:

```text
v26 alpha convention operations and chaos copilot
```

## 2 — Run the SQL migration

Supabase → SQL Editor:

```text
supabase/migrations/20260923_v26_alpha_chaos_ops.sql
```

Expected:

```text
Success. No rows returned
```

This migration:
- creates the convention catalog
- adds user ownership/catalog/readiness fields to Con Prep
- adds nested packing/checklist support
- adds nested prep-task support
- creates reusable loadout templates
- creates operator preferences
- creates Chaos Copilot threads/messages/actions
- creates short-lived reauthentication grants
- seeds reusable Dusk loadouts

## 3 — Add OpenAI server variables

Vercel → Project → Settings → Environment Variables:

```text
OPENAI_API_KEY=<your server-side key>
OPENAI_MODEL=gpt-5.6
```

`OPENAI_API_KEY` must never be prefixed with `NEXT_PUBLIC_`.

Redeploy after adding/changing it.

## 4 — Open Convention Ops

Visit:

```text
/dashboard/con-prep
```

On the first load, Alpha populates the convention catalog from the bundled
WikiFur attendance-ranked snapshot.

The catalog source policy is:

```text
official convention website/social > WikiFur > other/manual
```

## 5 — First deployment test

Pick a convention with known dates and click:

```text
I'M GOING
```

Confirm Dusk creates:
- Event
- Tactical Deployment Plan `/chaos/<slug>`
- Convention Ops deployment
- baseline packing/loadouts
- default prep tasks
- readiness record

Then open the deployment.

## 6 — Nested checklist test

Open the default **Donk Toss Kit** loadout or add any parent packing item.

Use:

```text
+ subitem
```

to add children.

The same is available for tasks with:

```text
+ subtask
```

## 7 — Chaos Copilot test

Inside the deployment try:

```text
Break Donk Toss Kit into a detailed checklist.
```

Chaos should create a **proposal**, not immediately change Supabase.

Review the payload and click:

```text
Apply
```

The new items should appear after the page refreshes.

## 8 — Social Ops Copilot

Open:

```text
/dashboard/posts
```

Try:

```text
Review my recent Social Ops plans and tell me where the copy is weak.
```

For an actionable request, Chaos stages a copy/schedule proposal.

## 9 — Sensitive-action reauthentication

Sensitive Chaos proposals show:

```text
REAUTH REQUIRED
```

Approving one prompts for the current Supabase password.

Alpha re-verifies the same signed-in email through Supabase Auth, issues a
one-use ten-minute server grant, then consumes that grant against the sensitive
action.

v26 Alpha deliberately does not let Copilot execute Publish Now after that
grant yet; the step-up architecture is being proven before higher-agency actions
are enabled.

## 10 — Existing systems

No changes are required to:
- Telegram
- X
- Instagram
- Bluesky
- existing Make Social Dispatcher
- Resend
- PWA notifications

The footer should read:

```text
Copyright 2026 Dusk Induskries.        v26.0 Alpha
```
