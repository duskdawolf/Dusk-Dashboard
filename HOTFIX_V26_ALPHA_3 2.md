# Dusk Industries v26.0 Alpha 3

Alpha 3 is primarily a Convention Ops UX / context-safety fix.

## Chaos Copilot

- Switching deployments now creates a genuinely fresh deployment-scoped chat.
- The browser clears thread id, transcript, proposals, draft input, and reauth
  state when the selected deployment changes.
- The deployment name is shown in the Copilot scope message.
- `New Chat` creates a new thread for the current deployment rather than
  reviving an older thread.
- Added quick prompts for Suggested Packing, Suggested Tasks, and Find Blockers.

This prevents a FurPoc conversation from bleeding into MFF/ANE/etc.

## Convention switcher

Upcoming deployments are now horizontal cards at the top of Convention Ops.

Selecting a card changes the entire deployment workspace directly below it,
with Chaos Copilot immediately underneath the selected deployment header.

## Less page clutter

The giant always-visible manual forms are gone.

- Convention manual entry is under `Add Deployment → Add Manually`.
- Packing manual entry is under `Add Manually`.
- Task manual entry is under `Add Manually`.
- Travel, hotel, badge, and budget manual forms are collapsed by default.
- The operational areas live in one expandable Deployment Workspace rather than
  a stack of disconnected page sections.

## Packing / task add bug

All async form handlers now capture the HTML form element before awaiting an API
request. This fixes the React `currentTarget` issue that could make Add appear
to fail after a successful request.

API failures are now surfaced directly in the page status instead of silently
doing nothing.

## Packing vs. tasks

Hotel `Checkout sweep` was incorrectly modeled as a packing item.

Alpha 3:
- removes it from the hotel loadout
- adds `Hotel checkout / room sweep` as a prep task
- renames `Room charging setup` to the clearer packing item
  `Phone / fan / battery chargers`

## Suggested tasks

The Tasks area now has one-click useful suggestions, and Chaos Copilot has a
dedicated `Suggest Tasks` quick prompt.

## SQL

If Alpha 1/2 SQL has already been run, run only:

```text
supabase/migrations/20260923_v26_alpha3_ops_ux.sql
```

For a fresh v26 installation, the base Alpha migration has also been corrected.

No new environment variables.
No Make changes.
