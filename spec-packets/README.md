# Spec Packets

Per-screen MD packets bundling everything needed to implement a screen (frontend + backend) in one file: meta, mode variants, navigation (ASCII screen + exits + entries), spec (screen text, AI context, coach voice, system actions, edge cases, chat preview), applicable UX rules inlined in full, related task acceptance criteria from the Tasks tab, and a test scaffold.

## Status

v1, `ONBOARD-01--FORM` only. The other 19 MVP screens land next week, when the build pipeline (`build_spec_packets.py` + `sync_nav.py`) moves into this repo. Timing will be confirmed at standup.

## How to read a packet

Each section is self-contained. Implementation can start straight from the packet. Cross-tab references (UX rules, tasks, PostHog events) are inlined; no chasing across the Master Sheet.

## Source of truth

When the build pipeline lands in this repo, packets auto-derive from:

- **Master Sheet `Screens` tab**: content, voice config, system actions, edge cases.
- **`gg-figma-plugin/assistant/code.js` `FLOWS` array**: tap navigation.
- **Master Sheet new columns** (`voice_exits`, `variant_pair`, `fallback_exits`): voice + variant + fallback nav.

Until that lands, this v1 is hand-curated. Edits to the spec should go to the Master Sheet, not these files.

## Feedback

Comment inline on the MR, or drop in the dev Mattermost channel.
