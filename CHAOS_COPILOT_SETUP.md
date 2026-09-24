# Dusk Industries v26 Alpha — Chaos Copilot™ Setup

## Vercel

Add:

```text
OPENAI_API_KEY
OPENAI_COPILOT_MODEL=gpt-5.6-luna
```

`OPENAI_API_KEY` must remain server-side. Do not use a `NEXT_PUBLIC_` prefix.

Redeploy after setting it.

## Where Chaos Copilot appears

```text
/dashboard
/dashboard/con-prep
/dashboard/posts
```

The deployment-scoped instance receives the current Convention Ops record,
packing list, prep tasks, travel, hotel, registration, costs, and event data.

The Social Ops instance receives recent posts or a specific post context,
including platform destinations and available publishing state.

## Proposal model

Chaos Copilot does not write arbitrary database state.

```text
conversation
→ function proposal
→ copilot_actions row
→ user reviews
→ Apply
→ typed server operation
→ Supabase
```

Normal actions require an explicit Apply click.

Sensitive actions also require a fresh step-up check against Supabase Auth.

## Sensitive-action reauthentication

The Alpha uses a fresh password verification against the current Supabase Auth
account.

On success Dusk creates a random one-use grant valid for ten minutes.

Only its SHA-256 hash is stored in:

```text
security_grants
```

The raw grant is returned to the browser once, consumed for the requested
sensitive action, and then cannot be reused.

`publish_now` is implemented as:

```text
reauthenticate
→ validate live provider jobs
→ mark them due now
→ existing Make Social Dispatcher
→ provider adapters
```

Chaos Copilot never directly calls the social providers.

## Alpha tools

Current proposal tools:

```text
propose_packing_items
propose_tasks
propose_social_copy
propose_social_schedule
propose_publish_now
```

Packing/task tools support parent relationships, allowing AI to propose:

```text
Donk Toss Kit
  ├─ Tournament kit
  ├─ Signage
  ├─ Prizes
  ├─ Stickers
  └─ Tape / setup supplies
```

## Convention-source rule

Copilot is instructed to use this priority:

```text
official convention website / official social
> WikiFur
> other sources
```

It must not fabricate convention dates, venue details, policies, reservations,
or historical performance metrics.

## Social optimization

Chaos Copilot may propose:
- master-caption rewrites
- platform-specific caption variants
- scheduled times
- immediate publishing after step-up approval

It is instructed to distinguish real Dusk performance data from generic timing
reasoning. Sparse data must be described as low-confidence rather than presented
as an evidence-backed recommendation.

## Future Beta architecture

v26's new Copilot records already carry `user_id`, and Convention Ops records
carry `owner_user_id`.

Alpha remains the private Dusk deployment. The ownership columns are groundwork
for the later multi-profile Beta rather than a public-registration feature.


## Alpha 4 cost controls

Alpha 4 defaults to:

```text
OPENAI_COPILOT_MODEL=gpt-5.6-luna
reasoning=low
verbosity=low
max output=900 tokens
store=false
prompt caching=explicit-only, no breakpoint
history=last 4 messages
```

With explicit cache mode and no explicit breakpoint, the request does not create
prompt-cache writes. Dusk records the OpenAI usage object on each assistant
message and exposes a rolling 24-hour admin usage card on `/dashboard`.
