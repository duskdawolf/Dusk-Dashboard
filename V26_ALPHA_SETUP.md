# v26 Alpha — Convention Operations + CHAOS COPILOT™ Setup

## Architecture

```text
Normal Dashboard UI ─┐
                     ├── typed Dusk server operations ── Supabase
Chaos Copilot™ ──────┘

Chaos Copilot
      ↓
proposal
      ↓
copilot_actions
      ↓
user review
      ↓
Apply / Reject
      ↓
server validation
      ↓
Supabase
```

Copilot never receives a raw arbitrary Supabase write tool.

## Convention Catalog authority

v26 Alpha follows this hierarchy:

```text
1. convention's own website / official social
2. WikiFur
3. other/manual source
```

The catalog's pre-populated membership/order comes from:

```text
https://en.wikifur.com/wiki/List_of_in-person_furry_conventions_by_attendance
```

Specifically the **Ongoing events** attendance ranking.

The bundled snapshot keeps:
- rank
- convention
- latest attendance year
- location
- country
- latest announced attendance

Upcoming dates in the bundled data come from WikiFur's upcoming-events data
where available.

When Dusk later stores a verified official convention record, WikiFur sync will
not overwrite it.

## Convention easy-add

```text
Catalog
  ↓
I'M GOING
  ↓
events
  ↓
con_preps
  ↓
Tactical Deployment Plan
  ↓
loadouts
  ↓
tasks
```

Unknown-date catalog entries remain usable: enter start/end dates before
deployment. Dusk does not guess them.

## Default loadouts

Global Alpha templates:

```text
Convention Core
Dusk Fullsuit
Pup / Nightlife Gear
Donk Toss Kit
Hotel Stay
Road Trip
```

Templates support nested children.

## Operator defaults

On first deployment use, v26 creates:

```text
Timezone             America/New_York
Airport arrival      90 min early
Safety buffer        15 min
Sticker production   50/hour
Print Tue             3–10 PM
Print Wed             3–10 PM
```

The schema stores these per user so Beta can give every furry their own
settings later.

## Chaos Copilot

Required Vercel variables:

```text
OPENAI_API_KEY
OPENAI_MODEL=gpt-5.6
```

Alpha contexts:

```text
global
deployment
social
```

Each context gets its own persistent Dusk-side thread/messages.

The current database state is fetched for every request.

## Approval levels

### Read-only reasoning

No confirmation needed.

Examples:
- What am I missing?
- What is overdue?
- Which caption is too long?
- What does my recent performance data say?

### Normal proposal

Explicit Apply/Reject.

Examples:
- add packing items
- add nested kit items
- add tasks/subtasks
- rewrite Social copy
- schedule Social destinations

### Sensitive proposal

Explicit approval + fresh Supabase password reauthentication.

Examples:
- immediate publication
- future destructive/account/security actions

A raw grant is returned only to the authenticated browser and is consumed once.
The database stores only a hash.

## Alpha vs future Beta

Alpha intentionally remains the private Dusk operator system.

However, new v26 data is user-scoped so Beta can later add:
- public account registration
- furry profiles
- per-user homepage/profile content
- each user's own deployments
- each user's own Copilot threads
- each user's own loadouts/preferences

Do not expose registration/public multi-tenancy in Alpha.
