# Dusk Dashboard knowledge base

**Current baseline:** Alpha v31.2 — Convention Directory. These pages describe checked-in implementation and SQL. Hosted activation still requires applying the migration, reviewing imported records and configuring official sources; see [release notes](releases/alpha-v31.2.md).

## Start here

| Topic | Document |
| --- | --- |
| Stack, runtime boundaries and source map | [Architecture](architecture.md) |
| Tables, relationships and migration history | [Database / data model](data-model.md) |
| Local development and hosted deployment | [Setup](setup.md) |
| Authorization, public/private data and credentials | [Security](security.md) |
| Version sources and release checks | [Releases](releases.md) |

## Current features

| Topic | Document |
| --- | --- |
| Official Series/Edition directory, review and refresh | [Convention Directory](features/convention-directory.md) |
| Event identity and deployment lifecycle | [Events / Deployments](features/events-deployments.md) |
| Personal planning workspace | [Deployment Ops](features/deployment-ops.md) |
| Scores, state transitions and competing legacy paths | [Readiness and automatic lifecycle](features/readiness-lifecycle.md) |
| Public appearance summaries | [Where to Find Dusk](features/where-to-find-dusk.md) |
| Branded route posters and image generation | [Next Stop](features/next-stop.md) |
| Context, proposals, approval and application | [Chaos Copilot](features/chaos-copilot.md) |
| Providers, Make, automation tick and Supabase Cron | [Social publishing and automation](features/social-automation.md) |
| Reusable assets and event attachments | [Media Library](features/media-library.md) |
| Tactical Deployment Plans and Case Studies | [Public deployment pages](features/public-deployment-pages.md) |

## Product specification

[Alpha v31.2 Convention Directory](product-specs/alpha-v31.2-convention-directory.md) records the implemented requirements and acceptance mapping. Operational scope and remaining source-adapter limitations are in the [feature guide](features/convention-directory.md).

## Reading conventions

- **CURRENT** describes observable code or SQL in the baseline. A feature can still require credentials, migration application or operational activation.
- **Known limitations** record mismatches and incomplete paths found during inspection. They are not automatically fixed by this documentation.
- **PLANNED** describes intended behavior that must not be presented as available today.
- Source links point to the implementing files. Review those files when changing a feature; update its page alongside the change.

The root README, upgrade guides and earlier Alpha setup notes remain historical release material. They include outdated architecture and installation claims. Use this index for the current map, and [setup](setup.md) for the limits of the SQL installation instructions.
